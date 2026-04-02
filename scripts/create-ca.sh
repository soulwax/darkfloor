#!/usr/bin/env bash
# create-ca.sh - Creates a new general-purpose Root CA certificate and private key.
#
# SYNOPSIS
#   Creates a self-signed Root CA certificate (ca.pem) and its corresponding
#   private key (ca.key) using OpenSSL. Output is placed in '../certs' relative
#   to the script's location by default.
#
# USAGE
#   ./create-ca.sh [OPTIONS]
#
# OPTIONS
#   -d, --ca-directory DIR    Directory to store CA files (default: ../certs)
#   -s, --ca-subject SUBJECT  Distinguished Name for the CA certificate
#   -l, --lifespan DAYS       Validity period in days (default: 3650 / 10 years)
#   -k, --key-size BITS       RSA key size in bits (default: 2048)
#   -h, --help                Show this help message
#
# EXAMPLES
#   ./create-ca.sh
#   ./create-ca.sh -s "C=GB, O=Acme Corp, CN=Acme Root CA" -l 7300
#
# NOTES
#   - pathlen:0 in basicConstraints means this CA cannot issue intermediate CAs.
#   - The CA private key password is crucial. Store it securely.
#   - An unencrypted CA private key should only be used for testing.

set -euo pipefail

# --- Defaults ---
CA_DIRECTORY=""
CA_SUBJECT=""
CA_LIFESPAN_DAYS=3650
KEY_SIZE=2048

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()    { echo -e "${CYAN}$*${NC}"; }
success() { echo -e "${GREEN}$*${NC}"; }
warn()    { echo -e "${YELLOW}WARNING: $*${NC}"; }
error()   { echo -e "${RED}ERROR: $*${NC}" >&2; }

usage() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Creates a new Root CA certificate and private key using OpenSSL.

Options:
  -d, --ca-directory DIR    Directory to store CA files (default: ../certs relative to script)
  -s, --ca-subject SUBJECT  Distinguished Name for the CA certificate
  -l, --lifespan DAYS       Validity period in days (default: 3650)
  -k, --key-size BITS       RSA key size in bits (default: 2048)
  -h, --help                Show this help message

Example:
  $(basename "$0") -s "C=US, ST=State, L=City, O=My Org, CN=My Root CA" -l 7300
EOF
}

check_openssl() {
    info "Checking for OpenSSL installation..."
    if command -v openssl &>/dev/null; then
        OPENSSL_PATH=$(command -v openssl)
        success "OpenSSL found at: $OPENSSL_PATH"
    else
        error "OpenSSL not found in your system's PATH."
        echo "Please install OpenSSL:"
        echo "  macOS:  brew install openssl"
        echo "  Ubuntu: sudo apt-get install openssl"
        echo "  Fedora: sudo dnf install openssl"
        return 1
    fi
}

# --- Parse Arguments ---
while [[ $# -gt 0 ]]; do
    case "$1" in
        -d|--ca-directory) CA_DIRECTORY="$2"; shift 2 ;;
        -s|--ca-subject)   CA_SUBJECT="$2";   shift 2 ;;
        -l|--lifespan)     CA_LIFESPAN_DAYS="$2"; shift 2 ;;
        -k|--key-size)     KEY_SIZE="$2";     shift 2 ;;
        -h|--help)         usage; exit 0 ;;
        *) error "Unknown option: $1"; usage; exit 1 ;;
    esac
done

# --- Cleanup trap ---
TEMP_KEY_PATH=""
OPENSSL_CONFIG_PATH=""

cleanup() {
    [[ -n "$TEMP_KEY_PATH"      && -f "$TEMP_KEY_PATH"      ]] && rm -f "$TEMP_KEY_PATH"
    [[ -n "$OPENSSL_CONFIG_PATH" && -f "$OPENSSL_CONFIG_PATH" ]] && rm -f "$OPENSSL_CONFIG_PATH"
}
trap cleanup EXIT

# --- Main ---
main() {
    # 1. Check OpenSSL
    check_openssl || exit 1

    # 2. Define Paths
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    if [[ -z "$CA_DIRECTORY" ]]; then
        PARENT_CERTS="$SCRIPT_DIR/../certs"
        if [[ -d "$PARENT_CERTS" ]]; then
            CERTS_DIR="$PARENT_CERTS"
        else
            # ../certs doesn't exist — use ./certs next to the script instead
            CERTS_DIR="$SCRIPT_DIR/certs"
            info "Note: '../certs' not found, using '$CERTS_DIR' instead."
        fi
    else
        CERTS_DIR="$CA_DIRECTORY"
    fi

    CA_KEY_PATH="$CERTS_DIR/ca.key"
    CA_CERT_PATH="$CERTS_DIR/ca.pem"
    TEMP_KEY_PATH="$CERTS_DIR/ca_temp.key"
    OPENSSL_CONFIG_PATH="$CERTS_DIR/openssl_ca.cnf"

    # 3. Create Directory
    info "Ensuring directory '$CERTS_DIR' exists..."
    mkdir -p "$CERTS_DIR"
    success "Directory ready."

    # 4. Gather User Input
    if [[ -z "$CA_SUBJECT" ]]; then
        DEFAULT_SUBJECT="C=US, ST=State, L=City, O=My Organization, OU=MyOrg CA, CN=MyOrg Root CA"
        read -rp "Enter CA Subject (e.g., $DEFAULT_SUBJECT): " CA_SUBJECT
        if [[ -z "$CA_SUBJECT" ]]; then
            CA_SUBJECT="$DEFAULT_SUBJECT"
            warn "Using default CA Subject: $CA_SUBJECT"
        fi
    fi

    echo -n "Enter a strong password for the CA private key (leave blank for no password - NOT RECOMMENDED for production!): "
    read -rs CA_PASSWORD
    echo

    # 5. Generate CA Private Key
    info "Generating CA private key (${KEY_SIZE}-bit RSA)..."
    openssl genrsa -out "$TEMP_KEY_PATH" "$KEY_SIZE"
    success "Temporary private key generated."

    if [[ -n "$CA_PASSWORD" ]]; then
        info "Encrypting CA private key with AES256..."
        openssl rsa -aes256 -in "$TEMP_KEY_PATH" -out "$CA_KEY_PATH" -passout "pass:$CA_PASSWORD"
        rm -f "$TEMP_KEY_PATH"
        KEY_PASS_ARG="-passin pass:$CA_PASSWORD"
        success "CA private key saved (encrypted)."
    else
        warn "CA private key will be saved UNENCRYPTED. This is HIGHLY INSECURE for production."
        cp "$TEMP_KEY_PATH" "$CA_KEY_PATH"
        rm -f "$TEMP_KEY_PATH"
        KEY_PASS_ARG=""
        warn "CA private key saved (unencrypted)."
    fi
    chmod 600 "$CA_KEY_PATH"

    # 6. Create OpenSSL Config File
    info "Creating temporary OpenSSL configuration file for CA extensions..."

    # Parse subject string into individual DN components for the config file
    DN_CONFIG=""
    IFS=',' read -ra SUBJECT_PARTS <<< "$CA_SUBJECT"
    for part in "${SUBJECT_PARTS[@]}"; do
        # Trim leading/trailing whitespace
        part="${part#"${part%%[![:space:]]*}"}"
        part="${part%"${part##*[![:space:]]}"}"
        if [[ "$part" =~ ^([A-Za-z]+)=(.*)$ ]]; then
            DN_CONFIG="${DN_CONFIG}${BASH_REMATCH[1]} = ${BASH_REMATCH[2]}"$'\n'
        fi
    done

    cat > "$OPENSSL_CONFIG_PATH" <<EOF
[ req ]
distinguished_name = req_distinguished_name
x509_extensions = v3_ca
prompt = no

[ req_distinguished_name ]
${DN_CONFIG}
[ v3_ca ]
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid:always,issuer
basicConstraints = critical, CA:true, pathlen:0
keyUsage = critical, digitalSignature, cRLSign, keyCertSign
EOF
    success "OpenSSL configuration file created."

    # 7. Generate Self-Signed CA Certificate
    info "Generating self-signed CA certificate for '$CA_SUBJECT'..."
    # shellcheck disable=SC2086
    openssl req -x509 -new $KEY_PASS_ARG \
        -key "$CA_KEY_PATH" \
        -sha256 \
        -days "$CA_LIFESPAN_DAYS" \
        -out "$CA_CERT_PATH" \
        -config "$OPENSSL_CONFIG_PATH"

    if [[ ! -f "$CA_CERT_PATH" ]]; then
        error "Failed to generate CA certificate at $CA_CERT_PATH."
        exit 1
    fi
    success "CA certificate generated successfully!"

    # 8. Display Summary
    echo
    success "--- CA Creation Summary ---"
    success "CA Private Key:  $CA_KEY_PATH"
    success "CA Certificate:  $CA_CERT_PATH"
    success "Validity:        $CA_LIFESPAN_DAYS days"
    success "Subject:         $CA_SUBJECT"
    echo
    info "Verifying CA certificate details:"
    openssl x509 -in "$CA_CERT_PATH" -noout -text

    echo
    warn "IMPORTANT: Securely store your '$CA_KEY_PATH' file and remember its password!"
}

main

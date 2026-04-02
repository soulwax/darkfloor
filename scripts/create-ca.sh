#!/usr/bin/env bash
# create-ca.sh - Creates a Root CA certificate and private key.
#
# SYNOPSIS
#   Generates a CA certificate ({name}.pem) and private key ({name}.key) via OpenSSL,
#   then optionally installs the certificate into the OS trust store so it is
#   recognised as legitimate by the system (browsers, curl, etc.).
#
# USAGE
#   ./create-ca.sh [OPTIONS]
#
# OPTIONS
#   -p, --path PATH           Explicit output path.
#                               Ends with .pem or .key → treat stem as name, parent as dir.
#                               Any other ending         → treat entire path as directory.
#   -d, --ca-directory DIR    Output directory (ignored when --path is given).
#                             Default: ../certs if it exists, else ./certs.
#   -n, --name NAME           Base name for output files (default: ca → ca.pem / ca.key).
#                             Overridden automatically when --path has a .pem/.key suffix.
#   -s, --ca-subject SUBJECT  Distinguished Name for the CA certificate.
#   -l, --lifespan DAYS       Validity period in days (default: 3650 / 10 years).
#   -k, --key-size BITS       RSA key size in bits (default: 2048).
#   -h, --help                Show this help message.
#
# EXAMPLES
#   ./create-ca.sh
#   ./create-ca.sh --path=../certs/sesame.pem
#   ./create-ca.sh --path=../certs/myca --name=myca
#   ./create-ca.sh --name=myca -s "C=DE, O=Acme, CN=Acme Root CA" -l 7300
#
# NOTES
#   - A Root CA is necessarily self-signed; "trusted" means installed in the OS store.
#   - pathlen:0 means this CA cannot issue intermediate CAs.
#   - Keep the private key and its password secure.

set -euo pipefail

# --- Defaults ---
CA_PATH=""
CA_DIRECTORY=""
CA_NAME="ca"
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

Creates a Root CA certificate and private key using OpenSSL.

Options:
  -p, --path PATH           Explicit output path (see PATH LOGIC below)
  -d, --ca-directory DIR    Output directory (default: ../certs or ./certs fallback)
  -n, --name NAME           Base filename stem (default: ca → ca.pem / ca.key)
  -s, --ca-subject SUBJECT  Distinguished Name for the CA
  -l, --lifespan DAYS       Validity in days (default: 3650)
  -k, --key-size BITS       RSA key size (default: 2048)
  -h, --help                Show this help

PATH LOGIC (--path):
  --path=/dir/name.pem   stem 'name' used as filename; parent dir used as output dir
  --path=/dir/name.key   same — stem extracted, parent dir used
  --path=/dir/myfolder   entire path treated as output directory; --name controls filename

Examples:
  $(basename "$0") --path=../certs/sesame.pem
  $(basename "$0") --path=../certs/sesame.key
  $(basename "$0") --path=../certs/sesame
  $(basename "$0") --name=myca -s "C=US, O=Acme, CN=Acme Root CA"
EOF
}

check_openssl() {
    info "Checking for OpenSSL installation..."
    if command -v openssl &>/dev/null; then
        success "OpenSSL found at: $(command -v openssl)"
    else
        error "OpenSSL not found in PATH."
        echo "Install it with:"
        echo "  macOS:  brew install openssl"
        echo "  Ubuntu: sudo apt-get install openssl"
        echo "  Fedora: sudo dnf install openssl"
        return 1
    fi
}

# Resolve --path into CERTS_DIR, CA_NAME, CA_CERT_PATH, CA_KEY_PATH
resolve_path_arg() {
    # Normalise backslashes (Windows paths passed from PowerShell/cmd)
    local p="${CA_PATH//\\//}"
    # Strip trailing slash
    p="${p%/}"

    local basename="${p##*/}"
    local ext="${basename##*.}"

    if [[ "$basename" == *"."* && ( "$ext" == "pem" || "$ext" == "key" ) ]]; then
        # Stem becomes the name; parent becomes the directory
        CA_NAME="${basename%.*}"
        CERTS_DIR="${p%/*}"
        [[ -z "$CERTS_DIR" ]] && CERTS_DIR="."
    else
        # Treat the entire path as a directory
        CERTS_DIR="$p"
    fi

    CA_CERT_PATH="$CERTS_DIR/${CA_NAME}.pem"
    CA_KEY_PATH="$CERTS_DIR/${CA_NAME}.key"
}

# Resolve default directory when neither --path nor --ca-directory is given
resolve_default_dir() {
    local script_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local parent_certs="$script_dir/../certs"
    if [[ -d "$parent_certs" ]]; then
        CERTS_DIR="$parent_certs"
    else
        CERTS_DIR="$script_dir/certs"
        info "Note: '../certs' not found — using '$CERTS_DIR' instead."
    fi
    CA_CERT_PATH="$CERTS_DIR/${CA_NAME}.pem"
    CA_KEY_PATH="$CERTS_DIR/${CA_NAME}.key"
}

# Install the generated certificate into the OS trust store
install_trust_store() {
    local cert_path="$1"
    local cert_name="$2"
    echo
    read -rp "Install '$cert_name.pem' into the system trust store? [y/N]: " answer
    [[ ! "$answer" =~ ^[Yy]$ ]] && return 0

    local os
    os="$(uname -s)"

    if [[ "$os" == "Darwin" ]]; then
        info "Adding to macOS System Keychain (requires sudo)..."
        sudo security add-trusted-cert -d -r trustRoot \
            -k /Library/Keychains/System.keychain "$cert_path"
        success "Certificate trusted in macOS System Keychain."

    elif [[ "$os" == "Linux" ]]; then
        if command -v update-ca-certificates &>/dev/null; then
            # Debian / Ubuntu
            info "Adding to Debian/Ubuntu trust store (requires sudo)..."
            sudo cp "$cert_path" "/usr/local/share/ca-certificates/${cert_name}.crt"
            sudo update-ca-certificates
            success "Certificate trusted via update-ca-certificates."
        elif command -v update-ca-trust &>/dev/null; then
            # RHEL / Fedora / CentOS
            info "Adding to RHEL/Fedora trust store (requires sudo)..."
            sudo cp "$cert_path" "/etc/pki/ca-trust/source/anchors/${cert_name}.pem"
            sudo update-ca-trust extract
            success "Certificate trusted via update-ca-trust."
        elif command -v trust &>/dev/null; then
            # Arch Linux
            info "Adding to Arch Linux trust store (requires sudo)..."
            sudo trust anchor --store "$cert_path"
            success "Certificate trusted via trust anchor."
        else
            warn "Could not detect trust-store tooling. Manual install required:"
            echo "  Copy '$cert_path' to your distro's CA bundle directory"
            echo "  and run the appropriate update command."
        fi
    else
        warn "Unsupported OS '$os' for automatic trust-store installation."
        echo "  Manually import '$cert_path' into your system's trusted root store."
    fi
}

# --- Parse Arguments (supports both --flag value and --flag=value) ---
while [[ $# -gt 0 ]]; do
    case "$1" in
        --*=*)
            flag="${1%%=*}"
            val="${1#*=}"
            case "$flag" in
                --path)         CA_PATH="$val" ;;
                --ca-directory) CA_DIRECTORY="$val" ;;
                --name)         CA_NAME="$val" ;;
                --ca-subject)   CA_SUBJECT="$val" ;;
                --lifespan)     CA_LIFESPAN_DAYS="$val" ;;
                --key-size)     KEY_SIZE="$val" ;;
                *) error "Unknown option: $1"; usage; exit 1 ;;
            esac
            shift ;;
        -p|--path)         CA_PATH="$2";         shift 2 ;;
        -d|--ca-directory) CA_DIRECTORY="$2";    shift 2 ;;
        -n|--name)         CA_NAME="$2";         shift 2 ;;
        -s|--ca-subject)   CA_SUBJECT="$2";      shift 2 ;;
        -l|--lifespan)     CA_LIFESPAN_DAYS="$2"; shift 2 ;;
        -k|--key-size)     KEY_SIZE="$2";        shift 2 ;;
        -h|--help)         usage; exit 0 ;;
        *) error "Unknown option: $1"; usage; exit 1 ;;
    esac
done

# --- Cleanup trap ---
TEMP_KEY_PATH=""
OPENSSL_CONFIG_PATH=""

cleanup() {
    [[ -n "$TEMP_KEY_PATH"       && -f "$TEMP_KEY_PATH"       ]] && rm -f "$TEMP_KEY_PATH"
    [[ -n "$OPENSSL_CONFIG_PATH" && -f "$OPENSSL_CONFIG_PATH" ]] && rm -f "$OPENSSL_CONFIG_PATH"
}
trap cleanup EXIT

# --- Main ---
main() {
    # 1. Check OpenSSL
    check_openssl || exit 1

    # 2. Resolve output paths
    if [[ -n "$CA_PATH" ]]; then
        resolve_path_arg
    elif [[ -n "$CA_DIRECTORY" ]]; then
        CERTS_DIR="$CA_DIRECTORY"
        CA_CERT_PATH="$CERTS_DIR/${CA_NAME}.pem"
        CA_KEY_PATH="$CERTS_DIR/${CA_NAME}.key"
    else
        resolve_default_dir
    fi

    TEMP_KEY_PATH="$CERTS_DIR/${CA_NAME}_temp.key"
    OPENSSL_CONFIG_PATH="$CERTS_DIR/openssl_${CA_NAME}.cnf"

    # 3. Create output directory
    info "Ensuring directory '$CERTS_DIR' exists..."
    mkdir -p "$CERTS_DIR"
    success "Directory ready."

    # 4. Gather user input
    if [[ -z "$CA_SUBJECT" ]]; then
        local default_subject="C=US, ST=State, L=City, O=My Organization, OU=MyOrg CA, CN=MyOrg Root CA"
        read -rp "Enter CA Subject (e.g., $default_subject): " CA_SUBJECT
        if [[ -z "$CA_SUBJECT" ]]; then
            CA_SUBJECT="$default_subject"
            warn "Using default CA Subject: $CA_SUBJECT"
        fi
    fi

    echo -n "Enter a password for the CA private key (blank = no password, NOT RECOMMENDED for production): "
    read -rs CA_PASSWORD
    echo

    # 5. Generate CA private key
    info "Generating CA private key (${KEY_SIZE}-bit RSA)..."
    openssl genrsa -out "$TEMP_KEY_PATH" "$KEY_SIZE"
    success "Temporary private key generated."

    if [[ -n "$CA_PASSWORD" ]]; then
        info "Encrypting CA private key with AES-256..."
        openssl rsa -aes256 -in "$TEMP_KEY_PATH" -out "$CA_KEY_PATH" -passout "pass:$CA_PASSWORD"
        rm -f "$TEMP_KEY_PATH"
        KEY_PASS_ARG="-passin pass:$CA_PASSWORD"
        success "CA private key saved (encrypted)."
    else
        warn "CA private key will be saved UNENCRYPTED. HIGHLY INSECURE for production."
        cp "$TEMP_KEY_PATH" "$CA_KEY_PATH"
        rm -f "$TEMP_KEY_PATH"
        KEY_PASS_ARG=""
        warn "CA private key saved (unencrypted)."
    fi
    chmod 600 "$CA_KEY_PATH"

    # 6. Build OpenSSL config
    info "Creating temporary OpenSSL configuration..."

    DN_CONFIG=""
    IFS=',' read -ra SUBJECT_PARTS <<< "$CA_SUBJECT"
    for part in "${SUBJECT_PARTS[@]}"; do
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

    # 7. Generate self-signed CA certificate
    info "Generating CA certificate for '$CA_SUBJECT'..."
    # shellcheck disable=SC2086
    openssl req -x509 -new $KEY_PASS_ARG \
        -key "$CA_KEY_PATH" \
        -sha256 \
        -days "$CA_LIFESPAN_DAYS" \
        -out "$CA_CERT_PATH" \
        -config "$OPENSSL_CONFIG_PATH"

    [[ ! -f "$CA_CERT_PATH" ]] && { error "Failed to generate CA certificate at '$CA_CERT_PATH'."; exit 1; }
    success "CA certificate generated successfully!"

    # 8. Summary
    echo
    success "--- CA Creation Summary ---"
    success "CA Private Key : $CA_KEY_PATH"
    success "CA Certificate : $CA_CERT_PATH"
    success "Validity       : $CA_LIFESPAN_DAYS days"
    success "Subject        : $CA_SUBJECT"
    echo
    info "Verifying certificate:"
    openssl x509 -in "$CA_CERT_PATH" -noout -text

    # 9. Optionally install into OS trust store
    install_trust_store "$CA_CERT_PATH" "$CA_NAME"

    echo
    warn "IMPORTANT: Keep '$CA_KEY_PATH' and its password secure!"
}

main

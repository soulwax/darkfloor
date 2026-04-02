#!/usr/bin/env bash
# ==============================================================================
# create-ca.sh — Root CA generator (Linux & macOS)
# ==============================================================================
#
# WHAT THIS DOES
#   Generates a CA (Certificate Authority) key pair using OpenSSL:
#     {name}.pem  — public certificate  (install as a trusted root)
#     {name}.key  — private key         (keep secret — used to sign other certs)
#
#   Optionally installs the cert into the OS trust store so all applications
#   on this machine accept it as a legitimate authority (browsers, curl, etc.).
#
# ------------------------------------------------------------------------------
# QUICK START
# ------------------------------------------------------------------------------
#   ./create-ca.sh                                  # interactive, all defaults
#   ./create-ca.sh --name=myca                      # → myca.pem + myca.key
#   ./create-ca.sh --path=../certs/myca.pem         # exact output path
#   ./create-ca.sh --no-password --force            # CI / automation friendly
#
# ------------------------------------------------------------------------------
# ALL FLAGS
# ------------------------------------------------------------------------------
#   -p, --path PATH           Explicit output path (see PATH LOGIC below).
#   -d, --ca-directory DIR    Output directory (overridden by --path).
#                             Default: ../certs if it exists, else ./certs.
#   -n, --name NAME           File stem. Default: ca → ca.pem + ca.key.
#                             Auto-set from --path when path ends in .pem/.key.
#       --cn NAME             Common Name shorthand  (sets CN= in the subject).
#       --org NAME            Organisation shorthand (sets O=  in the subject).
#       --country CC          Country code shorthand (sets C=  in the subject, 2 chars).
#   -s, --ca-subject SUBJECT  Full DN string. Example:
#                               "C=US, ST=State, L=City, O=Acme, CN=Acme Root CA"
#                             Providing this overrides --cn / --org / --country.
#   -l, --lifespan DAYS       Validity in days. Default: 3650 (10 years).
#   -k, --key-size BITS       RSA key size. Default: 2048. Ignored for ECDSA.
#       --algo rsa|ecdsa      Key algorithm. Default: rsa.
#       --curve CURVE         ECDSA curve (ignored for RSA). Default: prime256v1.
#                             Options: prime256v1 | secp384r1 | secp521r1
#       --pathlen N           CA chain depth limit. Default: 0 (no intermediates).
#                             Use --pathlen=-1 to remove the constraint entirely.
#       --no-password         Skip password prompt; save key unencrypted.
#                             Safe for CI pipelines and short-lived dev CAs.
#       --force               Overwrite existing .pem/.key files without prompting.
#   -h, --help                Show this help.
#
# ------------------------------------------------------------------------------
# PATH LOGIC  (--path)
# ------------------------------------------------------------------------------
#   --path=/dir/name.pem  →  stem 'name' used; parent used as directory.
#   --path=/dir/name.key  →  same — stem extracted, parent used as directory.
#   --path=/dir/myfolder  →  entire path treated as directory; --name controls stem.
#
# ------------------------------------------------------------------------------
# COMMON RECIPES
# ------------------------------------------------------------------------------
#   # 1. RSA CA with explicit subject and custom directory
#   ./create-ca.sh --name=acme --ca-directory=/etc/ssl/acme \
#     --ca-subject="C=DE, ST=Bavaria, O=Acme Corp, CN=Acme Root CA"
#
#   # 2. ECDSA CA (modern — smaller keys, same security)
#   ./create-ca.sh --name=myca --algo=ecdsa --curve=secp384r1
#
#   # 3. Shorthand subject flags
#   ./create-ca.sh --name=devca --cn="Dev Root CA" --org="My Org" --country=US
#
#   # 4. CA that can issue intermediate CAs (pathlen=1)
#   ./create-ca.sh --name=rootca --pathlen=1
#
#   # 5. Non-interactive — perfect for Docker builds / CI pipelines
#   ./create-ca.sh --name=ci-ca --no-password --force \
#     --cn="CI Root CA" --org="CI" --country=US
#
#   # 6. Short-lived dev CA
#   ./create-ca.sh --name=devca --lifespan=365 --no-password
#
# ------------------------------------------------------------------------------
# NEXT STEPS — sign a server certificate with this CA
# ------------------------------------------------------------------------------
#   # Generate a server key + CSR
#   openssl req -new -newkey rsa:2048 -nodes \
#     -keyout server.key -out server.csr \
#     -subj "/CN=localhost"
#
#   # Sign it with your CA
#   openssl x509 -req -in server.csr \
#     -CA ca.pem -CAkey ca.key -CAcreateserial \
#     -out server.pem -days 365 -sha256 \
#     -extfile <(printf "subjectAltName=DNS:localhost,IP:127.0.0.1")
#
# ==============================================================================

set -euo pipefail

# --- Defaults ---
CA_PATH=""
CA_DIRECTORY=""
CA_NAME="ca"
CA_SUBJECT=""
CA_CN=""
CA_ORG=""
CA_COUNTRY=""
CA_LIFESPAN_DAYS=3650
KEY_SIZE=2048
ALGO="rsa"
CURVE="prime256v1"
PATHLEN=0
NO_PASSWORD=false
FORCE=false

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
    # Print the full header comment block (all lines starting with # after the shebang),
    # stripping the leading '# ' so it reads like plain prose.
    awk 'NR == 1 { next }
         /^[^#]/ { exit }
         { sub(/^# ?/, ""); print }' "$0"
}

check_openssl() {
    info "Checking for OpenSSL..."
    if command -v openssl &>/dev/null; then
        success "OpenSSL found at: $(command -v openssl)"
    else
        error "OpenSSL not found in PATH."
        echo "  macOS:  brew install openssl"
        echo "  Ubuntu: sudo apt-get install openssl"
        echo "  Fedora: sudo dnf install openssl"
        return 1
    fi
}

# Resolve --path → CERTS_DIR + CA_NAME
resolve_path_arg() {
    local p="${CA_PATH//\\//}"   # normalise backslashes
    p="${p%/}"                   # strip trailing slash
    local leaf="${p##*/}"
    local ext="${leaf##*.}"
    if [[ "$leaf" == *"."* && ( "$ext" == "pem" || "$ext" == "key" ) ]]; then
        CA_NAME="${leaf%.*}"
        CERTS_DIR="${p%/*}"
        [[ -z "$CERTS_DIR" ]] && CERTS_DIR="."
    else
        CERTS_DIR="$p"
    fi
    CA_CERT_PATH="$CERTS_DIR/${CA_NAME}.pem"
    CA_KEY_PATH="$CERTS_DIR/${CA_NAME}.key"
}

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

# Guard against overwriting existing files unless --force
check_overwrite() {
    local file="$1"
    if [[ -f "$file" ]] && [[ "$FORCE" == false ]]; then
        read -rp "File '$file' already exists. Overwrite? [y/N]: " ow || true
        [[ ! "$ow" =~ ^[Yy]$ ]] && { error "Aborted — '$file' not overwritten."; exit 1; }
    fi
}

install_trust_store() {
    local cert_path="$1"
    local cert_name="$2"
    echo
    read -rp "Install '${cert_name}.pem' into the system trust store? [y/N]: " answer || true
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
            info "Adding to Debian/Ubuntu trust store (requires sudo)..."
            sudo cp "$cert_path" "/usr/local/share/ca-certificates/${cert_name}.crt"
            sudo update-ca-certificates
            success "Certificate trusted via update-ca-certificates."
        elif command -v update-ca-trust &>/dev/null; then
            info "Adding to RHEL/Fedora trust store (requires sudo)..."
            sudo cp "$cert_path" "/etc/pki/ca-trust/source/anchors/${cert_name}.pem"
            sudo update-ca-trust extract
            success "Certificate trusted via update-ca-trust."
        elif command -v trust &>/dev/null; then
            info "Adding to Arch Linux trust store (requires sudo)..."
            sudo trust anchor --store "$cert_path"
            success "Certificate trusted via trust anchor."
        else
            warn "Could not detect trust-store tooling. Manual install required."
            echo "  Copy '$cert_path' to your distro's CA bundle directory and run the update command."
        fi
    else
        warn "Unsupported OS '$os' for automatic trust-store installation."
        echo "  Manually import '$cert_path' into your system's trusted root store."
    fi
}

# --- Parse Arguments (supports both --flag value and --flag=value) ---
while [[ $# -gt 0 ]]; do
    # Split --flag=value into flag + val
    if [[ "$1" == --*=* ]]; then
        flag="${1%%=*}"; val="${1#*=}"; set -- "$flag" "$val" "${@:2}"
    fi
    case "$1" in
        -p|--path)         CA_PATH="$2";          shift 2 ;;
        -d|--ca-directory) CA_DIRECTORY="$2";     shift 2 ;;
        -n|--name)         CA_NAME="$2";          shift 2 ;;
           --cn)           CA_CN="$2";            shift 2 ;;
           --org)          CA_ORG="$2";           shift 2 ;;
           --country)      CA_COUNTRY="$2";       shift 2 ;;
        -s|--ca-subject)   CA_SUBJECT="$2";       shift 2 ;;
        -l|--lifespan)     CA_LIFESPAN_DAYS="$2"; shift 2 ;;
        -k|--key-size)     KEY_SIZE="$2";         shift 2 ;;
           --algo)         ALGO="$(tr '[:upper:]' '[:lower:]' <<< "$2")"; shift 2 ;;
           --curve)        CURVE="$2";            shift 2 ;;
           --pathlen)      PATHLEN="$2";          shift 2 ;;
           --no-password)  NO_PASSWORD=true;      shift ;;
           --force)        FORCE=true;            shift ;;
        -h|--help)         usage; exit 0 ;;
        *) error "Unknown option: $1"; echo "Run with --help for usage."; exit 1 ;;
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
    check_openssl || exit 1

    # Resolve output paths
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

    # Create output directory
    info "Ensuring directory '$CERTS_DIR' exists..."
    mkdir -p "$CERTS_DIR"
    success "Directory ready."

    # Guard existing files
    check_overwrite "$CA_CERT_PATH"
    check_overwrite "$CA_KEY_PATH"

    # Build subject
    if [[ -z "$CA_SUBJECT" ]]; then
        if [[ -n "$CA_CN" || -n "$CA_ORG" || -n "$CA_COUNTRY" ]]; then
            local parts=()
            [[ -n "$CA_COUNTRY" ]] && parts+=("C=${CA_COUNTRY}")
            [[ -n "$CA_ORG"     ]] && parts+=("O=${CA_ORG}")
            [[ -n "$CA_CN"      ]] && parts+=("CN=${CA_CN}")
            CA_SUBJECT="$(IFS=', '; echo "${parts[*]}")"
            info "Using subject: $CA_SUBJECT"
        else
            local default_subject="C=US, ST=State, L=City, O=My Organization, OU=MyOrg CA, CN=MyOrg Root CA"
            read -rp "Enter CA Subject (e.g., $default_subject): " CA_SUBJECT || true
            if [[ -z "$CA_SUBJECT" ]]; then
                CA_SUBJECT="$default_subject"
                warn "Using default CA Subject: $CA_SUBJECT"
            fi
        fi
    fi

    # Password
    local CA_PASSWORD=""
    if [[ "$NO_PASSWORD" == false ]]; then
        echo -n "Enter a password for the CA private key (blank = no password, NOT RECOMMENDED for production): "
        read -rs CA_PASSWORD || true
        echo
    fi

    # Generate private key
    local algo_label
    if [[ "$ALGO" == "ecdsa" ]]; then
        algo_label="ECDSA ($CURVE)"
        info "Generating CA private key ($algo_label)..."
        openssl ecparam -name "$CURVE" -genkey -noout -out "$TEMP_KEY_PATH"
    else
        algo_label="RSA ${KEY_SIZE}-bit"
        info "Generating CA private key ($algo_label)..."
        openssl genrsa -out "$TEMP_KEY_PATH" "$KEY_SIZE"
    fi
    success "Temporary private key generated."

    if [[ -n "$CA_PASSWORD" ]]; then
        info "Encrypting CA private key with AES-256..."
        if [[ "$ALGO" == "ecdsa" ]]; then
            openssl ec  -aes256 -in "$TEMP_KEY_PATH" -out "$CA_KEY_PATH" -passout "pass:$CA_PASSWORD"
        else
            openssl rsa -aes256 -in "$TEMP_KEY_PATH" -out "$CA_KEY_PATH" -passout "pass:$CA_PASSWORD"
        fi
        rm -f "$TEMP_KEY_PATH"
        KEY_PASS_ARG="-passin pass:$CA_PASSWORD"
        success "CA private key saved (encrypted)."
    else
        [[ "$NO_PASSWORD" == false ]] && warn "CA private key will be saved UNENCRYPTED. HIGHLY INSECURE for production."
        cp "$TEMP_KEY_PATH" "$CA_KEY_PATH"
        rm -f "$TEMP_KEY_PATH"
        KEY_PASS_ARG=""
        [[ "$NO_PASSWORD" == false ]] && warn "CA private key saved (unencrypted)."
    fi
    chmod 600 "$CA_KEY_PATH"

    # Build pathlen constraint
    local basic_constraints
    if [[ "$PATHLEN" -lt 0 ]]; then
        basic_constraints="critical, CA:true"
    else
        basic_constraints="critical, CA:true, pathlen:${PATHLEN}"
    fi

    # Build OpenSSL config DN section
    info "Creating temporary OpenSSL configuration..."
    local DN_CONFIG=""
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
basicConstraints = ${basic_constraints}
keyUsage = critical, digitalSignature, cRLSign, keyCertSign
EOF
    success "OpenSSL configuration file created."

    # Generate self-signed CA certificate
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

    # Summary
    echo
    success "--- CA Creation Summary ---"
    success "CA Private Key : $CA_KEY_PATH"
    success "CA Certificate : $CA_CERT_PATH"
    success "Algorithm      : $algo_label"
    success "Validity       : $CA_LIFESPAN_DAYS days"
    success "Subject        : $CA_SUBJECT"
    if [[ "$PATHLEN" -lt 0 ]]; then
        success "Path Length    : unlimited (can sign intermediate CAs)"
    else
        success "Path Length    : $PATHLEN"
    fi
    echo
    info "Verifying certificate:"
    openssl x509 -in "$CA_CERT_PATH" -noout -text

    install_trust_store "$CA_CERT_PATH" "$CA_NAME"

    echo
    warn "IMPORTANT: Keep '$CA_KEY_PATH' and its password secure!"
}

main

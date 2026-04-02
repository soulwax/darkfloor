#requires -Version 7.0

<#
.SYNOPSIS
    Creates a new general-purpose Root CA (Certificate Authority) certificate and private key.

.DESCRIPTION
    This script generates a self-signed Root CA certificate ('ca.pem') and its corresponding
    private key ('ca.key') using OpenSSL. The CA certificate is configured with appropriate
    extensions to allow it to sign other certificates (e.g., server, client certificates).

    The output files are placed in a 'certs' directory located one level up from the script's
    execution path (i.e., '../certs').

    It requires OpenSSL to be installed and available in the system's PATH.

.PARAMETER CADirectory
    Optional. Specifies the full path where the CA certificate and key files should be stored.
    Defaults to '../certs' relative to the script's location.

.PARAMETER CASubject
    Optional. The Distinguished Name (DN) for the CA certificate.
    Example: "C=US, ST=State, L=City, O=My Org, OU=MyOrg CA, CN=MyOrg Root CA"
    Defaults to a generic subject if not provided.

.PARAMETER CALifespanDays
    Optional. The validity period for the CA certificate in days.
    Defaults to 3650 days (10 years).

.PARAMETER KeySize
    Optional. The size of the RSA private key in bits.
    Defaults to 2048 bits.

.EXAMPLE
    .\Create-RootCA.ps1

    Prompts for CA subject and password, then creates the CA.

.EXAMPLE
    .\Create-RootCA.ps1 -CASubject "C=GB, O=Acme Corp, CN=Acme Root CA" -CALifespanDays 7300

    Creates a CA for "Acme Corp" valid for 20 years without prompting for the subject,
    but still prompts for the private key password.

.NOTES
    - The CA private key password is crucial for security. Choose a strong one and store it securely.
    - An unencrypted CA private key is highly insecure and should only be used for testing
      or short-lived, non-sensitive environments.
    - The 'ca.pem' file contains the public certificate. The 'ca.key' file contains the
      private key. Both are critical for the CA's function.
    - The 'pathlen:0' in basicConstraints means this CA cannot issue intermediate CAs.
      If you need intermediate CAs, remove `pathlen:0` or increase its value.
#>
[CmdletBinding(DefaultParameterSetName='Default')]
param(
    [string]$CADirectory,
    [string]$CASubject,
    [int]$CALifespanDays = 3650, # 10 years
    [int]$KeySize = 2048
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

#region --- Helper Functions ---

function Test-OpenSSLInstallation {
    <#
    .SYNOPSIS
        Checks if OpenSSL is installed and available in the system's PATH.
    .OUTPUTS
        [string] The path to openssl.exe if found, otherwise $null.
    #>
    Write-Host "Checking for OpenSSL installation..." -ForegroundColor Cyan
    $openSSLPath = (Get-Command openssl -ErrorAction SilentlyContinue).Source
    if ($null -ne $openSSLPath) {
        Write-Host "OpenSSL found at: $openSSLPath" -ForegroundColor Green
        return $openSSLPath
    } else {
        Write-Host "Error: OpenSSL not found in your system's PATH." -ForegroundColor Red
        Write-Host "Please install OpenSSL (e.g., using 'winget install OpenSSL.OpenSSL' or 'choco install openssl')." -ForegroundColor Yellow
        return $null
    }
}

#endregion

#region --- Main Script Logic ---

try {
    # 1. Check OpenSSL Installation
    $openSSLPath = Test-OpenSSLInstallation
    if ($null -eq $openSSLPath) {
        throw "OpenSSL is required but not found."
    }

    # 2. Define Paths
    $scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Definition
    if ([string]::IsNullOrWhiteSpace($CADirectory)) {
        $certsDir = Join-Path $scriptPath "..\certs"
    } else {
        $certsDir = $CADirectory
    }

    $caPrivateKeyPath = Join-Path $certsDir "ca.key"
    $caCertPath = Join-Path $certsDir "ca.pem"
    $tempPrivateKeyPath = Join-Path $certsDir "ca_temp.key" # For unencrypted key during generation
    $openSSLConfigPath = Join-Path $certsDir "openssl_ca.cnf"

    # 3. Create Directory
    Write-Host "Ensuring directory '$certsDir' exists..." -ForegroundColor Cyan
    New-Item -ItemType Directory -Path $certsDir -Force | Out-Null
    Write-Host "Directory ready." -ForegroundColor Green

    # 4. Gather User Input
    if ([string]::IsNullOrWhiteSpace($CASubject)) {
        $defaultSubject = "C=US, ST=State, L=City, O=My Organization, OU=MyOrg CA, CN=MyOrg Root CA"
        $CASubject = Read-Host -Prompt "Enter CA Subject (e.g., $defaultSubject)"
        if ([string]::IsNullOrWhiteSpace($CASubject)) {
            $CASubject = $defaultSubject
            Write-Host "Using default CA Subject: $CASubject" -ForegroundColor Yellow
        }
    }

    $caPrivateKeyPassword = Read-Host -Prompt "Enter a strong password for the CA private key (leave blank for no password - NOT RECOMMENDED for production!)" -AsSecureString
    $passwordPlain = if ($caPrivateKeyPassword) {
        [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($caPrivateKeyPassword))
    } else { $null }

    # 5. Generate CA Private Key (initially unencrypted, then encrypt if password provided)
    Write-Host "Generating CA private key ($($KeySize)-bit RSA)..." -ForegroundColor Cyan
    & $openSSLPath genrsa -out $tempPrivateKeyPath $KeySize
    if (-not (Test-Path $tempPrivateKeyPath)) {
        throw "Failed to generate temporary private key at $tempPrivateKeyPath."
    }
    Write-Host "Temporary private key generated." -ForegroundColor Green

    if ($passwordPlain) {
        Write-Host "Encrypting CA private key with AES256..." -ForegroundColor Cyan
        & $openSSLPath rsa -aes256 -in $tempPrivateKeyPath -out $caPrivateKeyPath -passout pass:$passwordPlain
        Remove-Item $tempPrivateKeyPath -Force
        $keyPasswordArgs = "-passin pass:$passwordPlain"
        Write-Host "CA private key saved (encrypted)." -ForegroundColor Green
    } else {
        Write-Host "WARNING: CA private key will be saved UNENCRYPTED. This is HIGHLY INSECURE for production." -ForegroundColor Yellow
        Copy-Item $tempPrivateKeyPath $caPrivateKeyPath -Force
        Remove-Item $tempPrivateKeyPath -Force
        $keyPasswordArgs = "-nodes" # No password needed for subsequent commands
        Write-Host "CA private key saved (unencrypted)." -ForegroundColor Yellow
    }

    # 6. Create OpenSSL Configuration File for CA Certificate
    Write-Host "Creating temporary OpenSSL configuration file for CA extensions..." -ForegroundColor Cyan

    # Parse subject string into individual DN components for the config file
    $subjectParts = @{}
    $CASubject.Split(',') | ForEach-Object {
        $part = $_.Trim()
        if ($part -match '^(?<key>\w+)=(?<value>.*)$') {
            $subjectParts[$matches.key] = $matches.value
        }
    }
    $dnConfig = ($subjectParts.GetEnumerator() | ForEach-Object { "$($_.Name) = $($_.Value)" }) -join "`n"

    $openSSLConfigContent = @"
[ req ]
distinguished_name = req_distinguished_name
x509_extensions = v3_ca
prompt = no # Don't prompt for DN values, use values from [req_distinguished_name]

[ req_distinguished_name ]
$dnConfig

[ v3_ca ]
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid:always,issuer
basicConstraints = critical, CA:true, pathlen:0  # pathlen:0 means this CA cannot issue intermediate CAs
keyUsage = critical, digitalSignature, cRLSign, keyCertSign
"@
    $openSSLConfigContent | Set-Content $openSSLConfigPath
    Write-Host "OpenSSL configuration file created." -ForegroundColor Green

    # 7. Generate Self-Signed CA Certificate
    Write-Host "Generating self-signed CA certificate for '$CASubject'..." -ForegroundColor Cyan
    & $openSSLPath req -x509 -new $keyPasswordArgs -key $caPrivateKeyPath -sha256 `
        -days $CALifespanDays -out $caCertPath -config $openSSLConfigPath

    if (-not (Test-Path $caCertPath)) {
        throw "Failed to generate CA certificate at $caCertPath."
    }
    Write-Host "CA certificate generated successfully!" -ForegroundColor Green

    # 8. Display Information
    Write-Host ""
    Write-Host "--- CA Creation Summary ---" -ForegroundColor Green
    Write-Host "CA Private Key:  $caPrivateKeyPath" -ForegroundColor Green
    Write-Host "CA Certificate:  $caCertPath" -ForegroundColor Green
    Write-Host "Validity:        $CALifespanDays days" -ForegroundColor Green
    Write-Host "Subject:         $CASubject" -ForegroundColor Green
    Write-Host ""
    Write-Host "Verifying CA certificate details:" -ForegroundColor Cyan
    & $openSSLPath x509 -in $caCertPath -noout -text

    Write-Host ""
    Write-Host "IMPORTANT: Securely store your '$caPrivateKeyPath' file and remember its password!" -ForegroundColor Yellow

}
catch {
    Write-Error "An error occurred during CA creation: $($_.Exception.Message)"
    Write-Host "CA creation failed." -ForegroundColor Red
}
finally {
    # 9. Clean up temporary files
    if (Test-Path $openSSLConfigPath) {
        Remove-Item $openSSLConfigPath -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path $tempPrivateKeyPath) {
        Remove-Item $tempPrivateKeyPath -Force -ErrorAction SilentlyContinue
    }
    # Clear secure string from memory if not already garbage collected
    if ($caPrivateKeyPassword) {
        $caPrivateKeyPassword.Dispose()
    }
    # Securely clear plain text password from memory
    if ($passwordPlain) {
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($caPrivateKeyPassword))
        $passwordPlain = $null
    }
}

#endregion
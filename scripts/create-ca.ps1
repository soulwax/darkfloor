#requires -Version 7.0

<#
.SYNOPSIS
    Creates a Root CA certificate and private key, with optional OS trust-store installation.

.DESCRIPTION
    Generates a CA certificate ({Name}.pem) and private key ({Name}.key) via OpenSSL.
    Optionally installs the certificate into the Windows Trusted Root store so it is
    recognised as legitimate by the OS, browsers, and other tools.

    Output location is determined in this priority order:
      1. -Path   — explicit file or directory path (see PATH LOGIC below)
      2. -CADirectory — explicit output directory
      3. ..\certs relative to the script, falling back to .\certs

.PARAMETER Path
    Optional. Explicit output path.
      Ends with .pem or .key  →  stem becomes the Name; parent directory used as output dir.
      Any other ending        →  entire path treated as a directory.
    Examples:
      -Path ..\certs\sesame.pem    → Name=sesame, dir=..\certs
      -Path ..\certs\sesame.key    → Name=sesame, dir=..\certs
      -Path ..\certs\sesame        → dir=..\certs\sesame, Name from -Name (default: ca)

.PARAMETER CADirectory
    Optional. Output directory. Ignored when -Path is given.
    Defaults to '..\certs' (falling back to '.\certs' if that does not exist).

.PARAMETER Name
    Optional. Base filename stem. Default: 'ca' → ca.pem / ca.key.
    Overridden automatically when -Path carries a .pem/.key suffix.

.PARAMETER CASubject
    Optional. Distinguished Name for the CA certificate.
    Example: "C=US, ST=State, L=City, O=My Org, OU=MyOrg CA, CN=MyOrg Root CA"

.PARAMETER CALifespanDays
    Optional. Validity period in days. Default: 3650 (10 years).

.PARAMETER KeySize
    Optional. RSA key size in bits. Default: 2048.

.EXAMPLE
    .\create-ca.ps1 --path=..\certs\sesame.pem

.EXAMPLE
    .\create-ca.ps1 -Name myca -CASubject "C=DE, O=Acme, CN=Acme Root CA" -CALifespanDays 7300

.NOTES
    - A Root CA is necessarily self-signed; "trusted" means installed in the OS store.
    - pathlen:0 means this CA cannot issue intermediate CAs.
    - Keep the private key and its password secure.
#>
[CmdletBinding(DefaultParameterSetName = 'Default')]
param(
    [string]$Path,
    [string]$CADirectory,
    [string]$Name = 'ca',
    [string]$CASubject,
    [int]$CALifespanDays = 3650,
    [int]$KeySize = 2048
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# Support GNU-style --flag=value syntax.
# PowerShell binds the first unrecognised positional string to $Path here,
# so we detect and re-route common patterns.
# ---------------------------------------------------------------------------
foreach ($param in @('Path', 'CADirectory', 'CASubject', 'Name')) {
    $val = (Get-Variable -Name $param -ErrorAction SilentlyContinue).Value
    if ($val -match '^--(path|ca-directory|ca-subject|name)=(.+)$') {
        $flag = $Matches[1]; $extracted = $Matches[2]
        switch ($flag) {
            'path'         { $Path        = $extracted; if ($param -ne 'Path')        { Set-Variable -Name $param -Value '' } }
            'ca-directory' { $CADirectory = $extracted; if ($param -ne 'CADirectory') { Set-Variable -Name $param -Value '' } }
            'ca-subject'   { $CASubject   = $extracted; if ($param -ne 'CASubject')   { Set-Variable -Name $param -Value '' } }
            'name'         { $Name        = $extracted; if ($param -ne 'Name')        { Set-Variable -Name $param -Value 'ca' } }
        }
    }
}

# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

function Test-OpenSSLInstallation {
    Write-Host 'Checking for OpenSSL installation...' -ForegroundColor Cyan
    $p = (Get-Command openssl -ErrorAction SilentlyContinue).Source
    if ($p) { Write-Host "OpenSSL found at: $p" -ForegroundColor Green; return $p }
    Write-Host 'Error: OpenSSL not found in PATH.' -ForegroundColor Red
    Write-Host "Install via: winget install OpenSSL.OpenSSL  OR  choco install openssl" -ForegroundColor Yellow
    return $null
}

function Resolve-OutputPaths {
    param([string]$PathArg, [string]$DirArg, [ref]$NameRef, [string]$ScriptDir)

    if (-not [string]::IsNullOrWhiteSpace($PathArg)) {
        # Normalise slashes
        $p = $PathArg -replace '\\', '/'
        $p = $p.TrimEnd('/')
        $leaf     = Split-Path $p -Leaf
        $ext      = [System.IO.Path]::GetExtension($leaf).TrimStart('.')

        if ($ext -eq 'pem' -or $ext -eq 'key') {
            # Stem → name, parent → directory
            $NameRef.Value = [System.IO.Path]::GetFileNameWithoutExtension($leaf)
            $dir = Split-Path $p -Parent
            if ([string]::IsNullOrWhiteSpace($dir)) { $dir = '.' }
            return $dir
        } else {
            # Entire path is the output directory
            return $p
        }
    }

    if (-not [string]::IsNullOrWhiteSpace($DirArg)) {
        return $DirArg
    }

    # Default: ..\certs → .\certs fallback
    $parentCerts = Join-Path $ScriptDir '..\certs'
    if (Test-Path $parentCerts -PathType Container) {
        return $parentCerts
    }
    $local = Join-Path $ScriptDir 'certs'
    Write-Host "Note: '..\certs' not found — using '$local' instead." -ForegroundColor Cyan
    return $local
}

function Install-TrustStore {
    param([string]$CertPath, [string]$CertName)

    $answer = Read-Host "Install '$CertName.pem' into the Windows Trusted Root store? (requires admin) [y/N]"
    if ($answer -notin @('y', 'Y', 'yes', 'Yes')) { return }

    try {
        Import-Certificate -FilePath $CertPath -CertStoreLocation 'Cert:\LocalMachine\Root' | Out-Null
        Write-Host "Certificate installed in Windows Trusted Root store." -ForegroundColor Green
        Write-Host "It will be trusted by all Windows applications on this machine." -ForegroundColor Green
    }
    catch {
        Write-Host "Failed to install certificate: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "Try running this script as Administrator." -ForegroundColor Yellow
    }
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

$openSSLConfigPath   = $null
$tempPrivateKeyPath  = $null

try {
    # 1. Check OpenSSL
    $openSSLPath = Test-OpenSSLInstallation
    if ($null -eq $openSSLPath) { throw 'OpenSSL is required but not found.' }

    # 2. Resolve output paths
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
    $nameRef   = [ref]$Name
    $certsDir  = Resolve-OutputPaths -PathArg $Path -DirArg $CADirectory -NameRef $nameRef -ScriptDir $scriptDir
    $Name      = $nameRef.Value   # may have been updated by Resolve-OutputPaths

    $caPrivateKeyPath   = Join-Path $certsDir "$Name.key"
    $caCertPath         = Join-Path $certsDir "$Name.pem"
    $tempPrivateKeyPath = Join-Path $certsDir "${Name}_temp.key"
    $openSSLConfigPath  = Join-Path $certsDir "openssl_${Name}.cnf"

    # 3. Create output directory
    Write-Host "Ensuring directory '$certsDir' exists..." -ForegroundColor Cyan
    New-Item -ItemType Directory -Path $certsDir -Force | Out-Null
    Write-Host 'Directory ready.' -ForegroundColor Green

    # 4. Gather user input
    if ([string]::IsNullOrWhiteSpace($CASubject)) {
        $defaultSubject = 'C=US, ST=State, L=City, O=My Organization, OU=MyOrg CA, CN=MyOrg Root CA'
        $CASubject = Read-Host "Enter CA Subject (e.g., $defaultSubject)"
        if ([string]::IsNullOrWhiteSpace($CASubject)) {
            $CASubject = $defaultSubject
            Write-Host "Using default CA Subject: $CASubject" -ForegroundColor Yellow
        }
    }

    $caPrivateKeyPassword = Read-Host `
        -Prompt 'Enter a password for the CA private key (blank = no password, NOT RECOMMENDED for production)' `
        -AsSecureString
    $passwordPlain = if ($caPrivateKeyPassword.Length -gt 0) {
        [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
            [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($caPrivateKeyPassword))
    } else { $null }

    # 5. Generate CA private key
    Write-Host "Generating CA private key ($KeySize-bit RSA)..." -ForegroundColor Cyan
    & $openSSLPath genrsa -out $tempPrivateKeyPath $KeySize
    if (-not (Test-Path $tempPrivateKeyPath)) { throw "Failed to generate temporary private key." }
    Write-Host 'Temporary private key generated.' -ForegroundColor Green

    if ($passwordPlain) {
        Write-Host 'Encrypting CA private key with AES-256...' -ForegroundColor Cyan
        & $openSSLPath rsa -aes256 -in $tempPrivateKeyPath -out $caPrivateKeyPath -passout "pass:$passwordPlain"
        Remove-Item $tempPrivateKeyPath -Force
        $keyPasswordArgs = "-passin pass:$passwordPlain"
        Write-Host 'CA private key saved (encrypted).' -ForegroundColor Green
    } else {
        Write-Host 'WARNING: CA private key will be saved UNENCRYPTED. HIGHLY INSECURE for production.' -ForegroundColor Yellow
        Copy-Item $tempPrivateKeyPath $caPrivateKeyPath -Force
        Remove-Item $tempPrivateKeyPath -Force
        $keyPasswordArgs = ''
        Write-Host 'CA private key saved (unencrypted).' -ForegroundColor Yellow
    }

    # 6. Build OpenSSL config
    Write-Host 'Creating temporary OpenSSL configuration...' -ForegroundColor Cyan
    $subjectParts = [ordered]@{}
    $CASubject.Split(',') | ForEach-Object {
        $part = $_.Trim()
        if ($part -match '^(?<key>\w+)=(?<value>.*)$') {
            $subjectParts[$Matches['key']] = $Matches['value']
        }
    }
    $dnConfig = ($subjectParts.GetEnumerator() | ForEach-Object { "$($_.Key) = $($_.Value)" }) -join "`n"

    @"
[ req ]
distinguished_name = req_distinguished_name
x509_extensions = v3_ca
prompt = no

[ req_distinguished_name ]
$dnConfig

[ v3_ca ]
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid:always,issuer
basicConstraints = critical, CA:true, pathlen:0
keyUsage = critical, digitalSignature, cRLSign, keyCertSign
"@ | Set-Content $openSSLConfigPath
    Write-Host 'OpenSSL configuration file created.' -ForegroundColor Green

    # 7. Generate self-signed CA certificate
    Write-Host "Generating CA certificate for '$CASubject'..." -ForegroundColor Cyan
    $opensslArgs = @('req', '-x509', '-new')
    if ($keyPasswordArgs) { $opensslArgs += $keyPasswordArgs.Split(' ') }
    $opensslArgs += @('-key', $caPrivateKeyPath, '-sha256', '-days', $CALifespanDays, '-out', $caCertPath, '-config', $openSSLConfigPath)
    & $openSSLPath @opensslArgs

    if (-not (Test-Path $caCertPath)) { throw "Failed to generate CA certificate at '$caCertPath'." }
    Write-Host 'CA certificate generated successfully!' -ForegroundColor Green

    # 8. Summary
    Write-Host ''
    Write-Host '--- CA Creation Summary ---' -ForegroundColor Green
    Write-Host "CA Private Key : $caPrivateKeyPath" -ForegroundColor Green
    Write-Host "CA Certificate : $caCertPath"       -ForegroundColor Green
    Write-Host "Validity       : $CALifespanDays days" -ForegroundColor Green
    Write-Host "Subject        : $CASubject"         -ForegroundColor Green
    Write-Host ''
    Write-Host 'Verifying certificate:' -ForegroundColor Cyan
    & $openSSLPath x509 -in $caCertPath -noout -text

    # 9. Optionally install into Windows trust store
    Install-TrustStore -CertPath $caCertPath -CertName $Name

    Write-Host ''
    Write-Host "IMPORTANT: Keep '$caPrivateKeyPath' and its password secure!" -ForegroundColor Yellow
}
catch {
    Write-Error "CA creation failed: $($_.Exception.Message)"
}
finally {
    if ($openSSLConfigPath  -and (Test-Path $openSSLConfigPath))  { Remove-Item $openSSLConfigPath  -Force -ErrorAction SilentlyContinue }
    if ($tempPrivateKeyPath -and (Test-Path $tempPrivateKeyPath)) { Remove-Item $tempPrivateKeyPath -Force -ErrorAction SilentlyContinue }
    if ($caPrivateKeyPassword) { $caPrivateKeyPassword.Dispose() }
    if ($passwordPlain) {
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR(
            [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($caPrivateKeyPassword))
        $passwordPlain = $null
    }
}

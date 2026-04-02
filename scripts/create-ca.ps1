#requires -Version 7.0

<#
.SYNOPSIS
    Root CA generator for Windows (PowerShell 7+).

.DESCRIPTION
    ===========================================================================
    WHAT THIS DOES
    ===========================================================================
    Generates a CA (Certificate Authority) key pair using OpenSSL:
      {Name}.pem  — public certificate  (install as a trusted root)
      {Name}.key  — private key         (keep secret — used to sign other certs)

    Optionally installs the certificate into the Windows Trusted Root store so
    all applications on this machine accept it as a legitimate authority.

    ===========================================================================
    QUICK START
    ===========================================================================
      .\create-ca.ps1                                  # interactive, defaults
      .\create-ca.ps1 --name=myca                      # → myca.pem + myca.key
      .\create-ca.ps1 --path=..\certs\myca.pem         # exact output path
      .\create-ca.ps1 --no-password --force            # CI / automation

    ===========================================================================
    ALL FLAGS
    ===========================================================================
      -Path PATH              Explicit output path (see PATH LOGIC).
      -CADirectory DIR        Output directory (overridden by -Path).
                              Default: ..\certs if it exists, else .\certs.
      -Name NAME              File stem. Default: ca → ca.pem + ca.key.
                              Auto-set from -Path when path ends in .pem/.key.
      -CN NAME                Common Name shorthand  (sets CN= in subject).
      -Org NAME               Organisation shorthand (sets O=  in subject).
      -Country CC             Country code shorthand (sets C=  in subject, 2 chars).
      -CASubject SUBJECT      Full DN string. Example:
                                "C=US, ST=State, L=City, O=Acme, CN=Acme Root CA"
                              Overrides -CN / -Org / -Country when provided.
      -CALifespanDays DAYS    Validity in days. Default: 3650 (10 years).
      -KeySize BITS           RSA key size. Default: 2048. Ignored for ECDSA.
      -Algo rsa|ecdsa         Key algorithm. Default: rsa.
      -Curve CURVE            ECDSA curve. Default: prime256v1.
                              Options: prime256v1 | secp384r1 | secp521r1
      -PathLen N              CA chain depth limit. Default: 0 (no intermediates).
                              Use -PathLen -1 to remove the constraint entirely.
      -NoPassword             Skip password prompt; save key unencrypted.
      -Force                  Overwrite existing files without prompting.

    ===========================================================================
    PATH LOGIC  (-Path)
    ===========================================================================
      -Path ..\certs\name.pem  →  stem 'name' used; parent used as directory.
      -Path ..\certs\name.key  →  same.
      -Path ..\certs\myfolder  →  entire path treated as directory.

    ===========================================================================
    COMMON RECIPES
    ===========================================================================
      # 1. RSA CA with explicit subject and directory
      .\create-ca.ps1 -Name acme -CADirectory C:\ssl\acme `
        -CASubject "C=DE, ST=Bavaria, O=Acme Corp, CN=Acme Root CA"

      # 2. ECDSA CA (modern — smaller keys, same security)
      .\create-ca.ps1 -Name myca -Algo ecdsa -Curve secp384r1

      # 3. Shorthand subject flags
      .\create-ca.ps1 -Name devca -CN "Dev Root CA" -Org "My Org" -Country US

      # 4. CA that can issue intermediate CAs (PathLen=1)
      .\create-ca.ps1 -Name rootca -PathLen 1

      # 5. Non-interactive — Docker / CI pipelines
      .\create-ca.ps1 -Name ci-ca -NoPassword -Force `
        -CN "CI Root CA" -Org "CI" -Country US

      # 6. Short-lived dev CA
      .\create-ca.ps1 -Name devca -CALifespanDays 365 -NoPassword

    ===========================================================================
    NEXT STEPS — sign a server certificate with this CA
    ===========================================================================
      # Generate a server key + CSR
      openssl req -new -newkey rsa:2048 -nodes `
        -keyout server.key -out server.csr -subj "/CN=localhost"

      # Sign it with your new CA
      openssl x509 -req -in server.csr `
        -CA ca.pem -CAkey ca.key -CAcreateserial `
        -out server.pem -days 365 -sha256 `
        -extfile san.cnf   # san.cnf: subjectAltName=DNS:localhost,IP:127.0.0.1

    ===========================================================================

.NOTES
    - A Root CA is necessarily self-signed; "trusted" means installed in the OS store.
    - pathlen:0 means this CA cannot issue intermediate CAs.
    - Keep the private key and its password secure.
#>

[CmdletBinding(DefaultParameterSetName = 'Default')]
param(
    [string]$Path,
    [string]$CADirectory,
    [string]$Name          = 'ca',
    [string]$CN,
    [string]$Org,
    [string]$Country,
    [string]$CASubject,
    [int]$CALifespanDays   = 3650,
    [int]$KeySize          = 2048,
    [string]$Algo          = 'rsa',
    [string]$Curve         = 'prime256v1',
    [int]$PathLen          = 0,
    [switch]$NoPassword,
    [switch]$Force,
    [switch]$Help
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# Support GNU-style --flag=value syntax.
# PowerShell binds unrecognised positional strings to the first [string] param.
# We detect and re-route all known flags here.
# ---------------------------------------------------------------------------
$gnuMap = @{
    'path'         = 'Path'
    'ca-directory' = 'CADirectory'
    'name'         = 'Name'
    'cn'           = 'CN'
    'org'          = 'Org'
    'country'      = 'Country'
    'ca-subject'   = 'CASubject'
    'algo'         = 'Algo'
    'curve'        = 'Curve'
}
foreach ($paramName in @('Path','CADirectory','Name','CN','Org','Country','CASubject','Algo','Curve')) {
    $current = (Get-Variable -Name $paramName -ErrorAction SilentlyContinue).Value
    if ([string]::IsNullOrWhiteSpace($current)) { continue }

    # --flag=value
    if ($current -match '^--([a-z-]+)=(.+)$') {
        $flagKey = $Matches[1]; $flagVal = $Matches[2]
        if ($gnuMap.ContainsKey($flagKey)) {
            Set-Variable -Name $gnuMap[$flagKey] -Value $flagVal
            if ($paramName -ne $gnuMap[$flagKey]) { Set-Variable -Name $paramName -Value '' }
        }
    }
    # --no-password | --force | --help  (bare boolean flags, no =value)
    if ($current -match '^--(no-password|force|help)$') {
        switch ($Matches[1]) {
            'no-password' { $NoPassword = $true }
            'force'       { $Force      = $true }
            'help'        { $Help       = $true }
        }
        Set-Variable -Name $paramName -Value ''
    }
    # --pathlen=N
    if ($current -match '^--pathlen=(-?\d+)$') {
        $PathLen = [int]$Matches[1]
        Set-Variable -Name $paramName -Value ''
    }
}

# Show help and exit — must happen after GNU parsing so --help is resolved
if ($Help) {
    Get-Help $MyInvocation.MyCommand.Path -Detailed
    exit 0
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

function Test-OpenSSLInstallation {
    Write-Host 'Checking for OpenSSL...' -ForegroundColor Cyan
    $p = (Get-Command openssl -ErrorAction SilentlyContinue).Source
    if ($p) { Write-Host "OpenSSL found at: $p" -ForegroundColor Green; return $p }
    Write-Host 'Error: OpenSSL not found in PATH.' -ForegroundColor Red
    Write-Host 'Install via: winget install OpenSSL.OpenSSL  OR  choco install openssl' -ForegroundColor Yellow
    return $null
}

function Resolve-OutputPaths {
    param([string]$PathArg, [string]$DirArg, [ref]$NameRef, [string]$ScriptDir)

    if (-not [string]::IsNullOrWhiteSpace($PathArg)) {
        $p    = ($PathArg -replace '\\', '/').TrimEnd('/')
        $leaf = Split-Path $p -Leaf
        $ext  = [System.IO.Path]::GetExtension($leaf).TrimStart('.')
        if ($ext -eq 'pem' -or $ext -eq 'key') {
            $NameRef.Value = [System.IO.Path]::GetFileNameWithoutExtension($leaf)
            $dir = Split-Path $p -Parent
            return [string]::IsNullOrWhiteSpace($dir) ? '.' : $dir
        }
        return $p
    }

    if (-not [string]::IsNullOrWhiteSpace($DirArg)) { return $DirArg }

    $parentCerts = Join-Path $ScriptDir '..\certs'
    if (Test-Path $parentCerts -PathType Container) { return $parentCerts }
    $local = Join-Path $ScriptDir 'certs'
    Write-Host "Note: '..\certs' not found — using '$local' instead." -ForegroundColor Cyan
    return $local
}

function Confirm-Overwrite {
    param([string]$FilePath, [bool]$ForceFlag)
    if ((Test-Path $FilePath) -and (-not $ForceFlag)) {
        $ow = Read-Host "File '$FilePath' already exists. Overwrite? [y/N]"
        if ($ow -notin @('y','Y','yes','Yes')) {
            Write-Error "Aborted — '$FilePath' not overwritten."
            exit 1
        }
    }
}

function Install-TrustStore {
    param([string]$CertPath, [string]$CertName)
    $answer = Read-Host "Install '${CertName}.pem' into the Windows Trusted Root store? (requires admin) [y/N]"
    if ($answer -notin @('y','Y','yes','Yes')) { return }
    try {
        Import-Certificate -FilePath $CertPath -CertStoreLocation 'Cert:\LocalMachine\Root' | Out-Null
        Write-Host 'Certificate installed in Windows Trusted Root store.' -ForegroundColor Green
        Write-Host 'It will be trusted by all Windows applications on this machine.' -ForegroundColor Green
    }
    catch {
        Write-Host "Failed to install certificate: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host 'Try running this script as Administrator.' -ForegroundColor Yellow
    }
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

$openSSLConfigPath  = $null
$tempPrivateKeyPath = $null

try {
    # 1. Check OpenSSL
    $openSSLPath = Test-OpenSSLInstallation
    if ($null -eq $openSSLPath) { throw 'OpenSSL is required but not found.' }

    # 2. Resolve output paths
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
    $nameRef   = [ref]$Name
    $certsDir  = Resolve-OutputPaths -PathArg $Path -DirArg $CADirectory -NameRef $nameRef -ScriptDir $scriptDir
    $Name      = $nameRef.Value

    $caPrivateKeyPath   = Join-Path $certsDir "$Name.key"
    $caCertPath         = Join-Path $certsDir "$Name.pem"
    $tempPrivateKeyPath = Join-Path $certsDir "${Name}_temp.key"
    $openSSLConfigPath  = Join-Path $certsDir "openssl_${Name}.cnf"

    # 3. Create output directory
    Write-Host "Ensuring directory '$certsDir' exists..." -ForegroundColor Cyan
    New-Item -ItemType Directory -Path $certsDir -Force | Out-Null
    Write-Host 'Directory ready.' -ForegroundColor Green

    # 4. Guard existing files
    Confirm-Overwrite -FilePath $caCertPath       -ForceFlag $Force.IsPresent
    Confirm-Overwrite -FilePath $caPrivateKeyPath -ForceFlag $Force.IsPresent

    # 5. Build subject
    if ([string]::IsNullOrWhiteSpace($CASubject)) {
        if ($CN -or $Org -or $Country) {
            $parts = @()
            if ($Country) { $parts += "C=$Country" }
            if ($Org)     { $parts += "O=$Org"     }
            if ($CN)      { $parts += "CN=$CN"      }
            $CASubject = $parts -join ', '
            Write-Host "Using subject: $CASubject" -ForegroundColor Cyan
        } else {
            $defaultSubject = 'C=US, ST=State, L=City, O=My Organization, OU=MyOrg CA, CN=MyOrg Root CA'
            $CASubject = Read-Host "Enter CA Subject (e.g., $defaultSubject)"
            if ([string]::IsNullOrWhiteSpace($CASubject)) {
                $CASubject = $defaultSubject
                Write-Host "Using default CA Subject: $CASubject" -ForegroundColor Yellow
            }
        }
    }

    # 6. Password
    $passwordPlain = $null
    if (-not $NoPassword) {
        $caPrivateKeyPassword = Read-Host `
            -Prompt 'Enter a password for the CA private key (blank = no password, NOT RECOMMENDED for production)' `
            -AsSecureString
        if ($caPrivateKeyPassword.Length -gt 0) {
            $passwordPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
                [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($caPrivateKeyPassword))
        }
    }

    # 7. Generate private key
    $algoNorm = $Algo.ToLower()
    if ($algoNorm -eq 'ecdsa') {
        $algoLabel = "ECDSA ($Curve)"
        Write-Host "Generating CA private key ($algoLabel)..." -ForegroundColor Cyan
        & $openSSLPath ecparam -name $Curve -genkey -noout -out $tempPrivateKeyPath
    } else {
        $algoLabel = "RSA $KeySize-bit"
        Write-Host "Generating CA private key ($algoLabel)..." -ForegroundColor Cyan
        & $openSSLPath genrsa -out $tempPrivateKeyPath $KeySize
    }
    if (-not (Test-Path $tempPrivateKeyPath)) { throw 'Failed to generate temporary private key.' }
    Write-Host 'Temporary private key generated.' -ForegroundColor Green

    $keyPasswordArgs = ''
    if ($passwordPlain) {
        Write-Host 'Encrypting CA private key with AES-256...' -ForegroundColor Cyan
        $encCmd = if ($algoNorm -eq 'ecdsa') { 'ec' } else { 'rsa' }
        & $openSSLPath $encCmd -aes256 -in $tempPrivateKeyPath -out $caPrivateKeyPath -passout "pass:$passwordPlain"
        Remove-Item $tempPrivateKeyPath -Force
        $keyPasswordArgs = "-passin pass:$passwordPlain"
        Write-Host 'CA private key saved (encrypted).' -ForegroundColor Green
    } else {
        if (-not $NoPassword) {
            Write-Host 'WARNING: CA private key will be saved UNENCRYPTED. HIGHLY INSECURE for production.' -ForegroundColor Yellow
        }
        Copy-Item $tempPrivateKeyPath $caPrivateKeyPath -Force
        Remove-Item $tempPrivateKeyPath -Force
        Write-Host 'CA private key saved (unencrypted).' -ForegroundColor Yellow
    }

    # 8. Build pathlen constraint
    $basicConstraints = if ($PathLen -lt 0) {
        'critical, CA:true'
    } else {
        "critical, CA:true, pathlen:$PathLen"
    }

    # 9. Build OpenSSL config
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
basicConstraints = $basicConstraints
keyUsage = critical, digitalSignature, cRLSign, keyCertSign
"@ | Set-Content $openSSLConfigPath
    Write-Host 'OpenSSL configuration file created.' -ForegroundColor Green

    # 10. Generate self-signed CA certificate
    Write-Host "Generating CA certificate for '$CASubject'..." -ForegroundColor Cyan
    $opensslArgs = @('req', '-x509', '-new')
    if ($keyPasswordArgs) { $opensslArgs += $keyPasswordArgs -split ' ' }
    $opensslArgs += @('-key', $caPrivateKeyPath, '-sha256', '-days', $CALifespanDays, '-out', $caCertPath, '-config', $openSSLConfigPath)
    & $openSSLPath @opensslArgs

    if (-not (Test-Path $caCertPath)) { throw "Failed to generate CA certificate at '$caCertPath'." }
    Write-Host 'CA certificate generated successfully!' -ForegroundColor Green

    # 11. Summary
    Write-Host ''
    Write-Host '--- CA Creation Summary ---' -ForegroundColor Green
    Write-Host "CA Private Key : $caPrivateKeyPath" -ForegroundColor Green
    Write-Host "CA Certificate : $caCertPath"       -ForegroundColor Green
    Write-Host "Algorithm      : $algoLabel"        -ForegroundColor Green
    Write-Host "Validity       : $CALifespanDays days" -ForegroundColor Green
    Write-Host "Subject        : $CASubject"         -ForegroundColor Green
    $pathLenDisplay = if ($PathLen -lt 0) { 'unlimited (can sign intermediate CAs)' } else { "$PathLen" }
    Write-Host "Path Length    : $pathLenDisplay"   -ForegroundColor Green
    Write-Host ''
    Write-Host 'Verifying certificate:' -ForegroundColor Cyan
    & $openSSLPath x509 -in $caCertPath -noout -text

    # 12. Optionally install into Windows trust store
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
    if ($null -ne $caPrivateKeyPassword) { $caPrivateKeyPassword.Dispose() }
    if ($passwordPlain) {
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR(
            [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($caPrivateKeyPassword))
        $passwordPlain = $null
    }
}

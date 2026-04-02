#requires -Version 7.0

[CmdletBinding(SupportsShouldProcess)]
param(
    [string[]]$FilePath,
    [switch]$AutoDiscover,
    [string]$CertDirectory,
    [string]$LeafCommonName = "Starchild Tauri Experimental Local Code Signing",
    [string]$LeafOrganization = "Darkfloor",
    [int]$LeafValidityDays = 825,
    [switch]$ForceReissue,
    [switch]$SkipTrustStoreInstall
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Info {
    param([string]$Message)
    Write-Host "[tauri:sign:win:self] $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "[tauri:sign:win:self] $Message" -ForegroundColor Green
}

function Test-OpenSSLInstallation {
    $openSSLPath = (Get-Command openssl -ErrorAction SilentlyContinue).Source
    if ($null -eq $openSSLPath) {
        throw "OpenSSL is required to issue the local code-signing certificate. Install it and ensure 'openssl' is on PATH."
    }

    return $openSSLPath
}

function Get-KeyPassphrase {
    foreach ($name in @(
        "STARCHILD_TAURI_CA_KEY_PASSPHRASE",
        "STARCHILD_CA_KEY_PASSPHRASE",
        "TAURI_CA_KEY_PASSPHRASE"
    )) {
        $value = [Environment]::GetEnvironmentVariable($name)
        if (-not [string]::IsNullOrWhiteSpace($value)) {
            return $value
        }
    }

    return $null
}

function Test-KeyIsEncrypted {
    param([string]$Path)

    $firstLines = Get-Content -LiteralPath $Path -TotalCount 6
    $encryptedPemMatches = @($firstLines | Select-String -Pattern "ENCRYPTED PRIVATE KEY").Length
    $encryptedLegacyMatches = @($firstLines | Select-String -Pattern "Proc-Type:\s*4,ENCRYPTED").Length
    return $encryptedPemMatches -gt 0 -or $encryptedLegacyMatches -gt 0
}

function Invoke-OpenSSL {
    param(
        [string]$OpenSSLPath,
        [string[]]$Arguments
    )

    & $OpenSSLPath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "OpenSSL command failed with exit code ${LASTEXITCODE}: openssl $($Arguments -join ' ')"
    }
}

function Add-CertificateIfMissing {
    param(
        [System.Security.Cryptography.X509Certificates.StoreName]$StoreName,
        [System.Security.Cryptography.X509Certificates.StoreLocation]$StoreLocation,
        [System.Security.Cryptography.X509Certificates.X509Certificate2]$Certificate
    )

    $store = [System.Security.Cryptography.X509Certificates.X509Store]::new($StoreName, $StoreLocation)
    try {
        $store.Open([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite)
        $existing = $store.Certificates | Where-Object Thumbprint -eq $Certificate.Thumbprint
        if ($null -eq $existing) {
            $store.Add($Certificate)
        }
    }
    finally {
        $store.Close()
    }
}

function New-EphemeralPassword {
    return [Convert]::ToBase64String(
        [System.Security.Cryptography.RandomNumberGenerator]::GetBytes(24)
    )
}

function Get-ResolvedTargets {
    param(
        [string]$DesktopDirectory,
        [string[]]$RequestedPaths,
        [switch]$Discover
    )

    $targets = [System.Collections.Generic.List[string]]::new()

    if ($Discover) {
        $releaseDir = Join-Path $DesktopDirectory "src-tauri\target\release"
        $primaryExe = Join-Path $releaseDir "starchild-tauri-experimental.exe"
        if (Test-Path -LiteralPath $primaryExe -PathType Leaf) {
            $targets.Add((Resolve-Path -LiteralPath $primaryExe).Path)
        }

        foreach ($pattern in @(
            (Join-Path $releaseDir "bundle\nsis\*.exe"),
            (Join-Path $releaseDir "bundle\msi\*.msi")
        )) {
            foreach ($match in Get-ChildItem -Path $pattern -File -ErrorAction SilentlyContinue) {
                $targets.Add($match.FullName)
            }
        }
    }

    foreach ($candidate in $RequestedPaths) {
        if ([string]::IsNullOrWhiteSpace($candidate)) {
            continue
        }

        if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
            throw "Signing target was not found: $candidate"
        }

        $targets.Add((Resolve-Path -LiteralPath $candidate).Path)
    }

    return @($targets | Select-Object -Unique)
}

function Ensure-CodeSigningMaterial {
    param(
        [string]$RepoRoot,
        [string]$OpenSSLPath,
        [string]$LeafCommonName,
        [string]$LeafOrganization,
        [int]$LeafValidityDays,
        [switch]$ForceReissue,
        [string]$CertDirectory
    )

    $certsRoot = if ([string]::IsNullOrWhiteSpace($CertDirectory)) {
        Join-Path $RepoRoot "certs"
    } else {
        $CertDirectory
    }

    $caKeyPath = Join-Path $certsRoot "ca.key"
    $caCertPath = Join-Path $certsRoot "ca.pem"
    if (-not (Test-Path -LiteralPath $caKeyPath -PathType Leaf)) {
        throw "Missing CA private key for Tauri signing: $caKeyPath"
    }
    if (-not (Test-Path -LiteralPath $caCertPath -PathType Leaf)) {
        throw "Missing CA certificate for Tauri signing: $caCertPath"
    }

    $leafDirectory = Join-Path $certsRoot "tauri-windows-codesign"
    $leafKeyPath = Join-Path $leafDirectory "codesign.key"
    $leafCsrPath = Join-Path $leafDirectory "codesign.csr"
    $leafCertPath = Join-Path $leafDirectory "codesign.cer"
    $leafPfxPath = Join-Path $leafDirectory "codesign.pfx"
    $extConfigPath = Join-Path $leafDirectory "codesign.ext"
    $metadataPath = Join-Path $leafDirectory "metadata.json"
    $serialPath = Join-Path $leafDirectory "codesign.srl"

    New-Item -ItemType Directory -Path $leafDirectory -Force | Out-Null

    $caCertificate = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new($caCertPath)
    $caThumbprint = $caCertificate.Thumbprint
    $leafSubject = "CN=$LeafCommonName, O=$LeafOrganization"

    $passphrase = Get-KeyPassphrase
    $keyIsEncrypted = Test-KeyIsEncrypted -Path $caKeyPath
    if ($keyIsEncrypted -and [string]::IsNullOrWhiteSpace($passphrase)) {
        throw "certs/ca.key is encrypted. Set STARCHILD_TAURI_CA_KEY_PASSPHRASE (or STARCHILD_CA_KEY_PASSPHRASE) before running the Tauri Windows signing flow."
    }

    $metadata = $null
    if (Test-Path -LiteralPath $metadataPath -PathType Leaf) {
        try {
            $metadata = Get-Content -LiteralPath $metadataPath -Raw | ConvertFrom-Json
        } catch {
            $metadata = $null
        }
    }

    $reissueRequired = $ForceReissue.IsPresent -or
        -not (Test-Path -LiteralPath $leafKeyPath -PathType Leaf) -or
        -not (Test-Path -LiteralPath $leafCertPath -PathType Leaf) -or
        $null -eq $metadata -or
        $metadata.caThumbprint -ne $caThumbprint -or
        $metadata.leafSubject -ne $leafSubject

    if (-not $reissueRequired) {
        try {
            $existingLeaf = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new($leafCertPath)
            if ($existingLeaf.NotAfter -le (Get-Date).AddDays(7)) {
                $reissueRequired = $true
            }
        } catch {
            $reissueRequired = $true
        }
    }

    if ($reissueRequired) {
        Write-Info "Issuing a local Windows code-signing certificate from certs/ca.pem..."

        foreach ($stale in @($leafKeyPath, $leafCsrPath, $leafCertPath, $leafPfxPath, $extConfigPath, $serialPath, $metadataPath)) {
            if (Test-Path -LiteralPath $stale) {
                Remove-Item -LiteralPath $stale -Force
            }
        }

        $extConfig = @"
[req]
distinguished_name = req_distinguished_name
prompt = no

[req_distinguished_name]
CN = $LeafCommonName
O = $LeafOrganization

[v3_codesign]
basicConstraints = critical, CA:false
keyUsage = critical, digitalSignature
extendedKeyUsage = codeSigning
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid,issuer
"@
        Set-Content -LiteralPath $extConfigPath -Value $extConfig -Encoding ascii

        Invoke-OpenSSL -OpenSSLPath $OpenSSLPath -Arguments @(
            "genrsa",
            "-out", $leafKeyPath,
            "3072"
        )

        Invoke-OpenSSL -OpenSSLPath $OpenSSLPath -Arguments @(
            "req",
            "-new",
            "-key", $leafKeyPath,
            "-out", $leafCsrPath,
            "-config", $extConfigPath
        )

        $x509Args = @(
            "x509",
            "-req",
            "-in", $leafCsrPath,
            "-CA", $caCertPath,
            "-CAkey", $caKeyPath,
            "-CAserial", $serialPath,
            "-CAcreateserial",
            "-out", $leafCertPath,
            "-days", [string]$LeafValidityDays,
            "-sha256",
            "-extfile", $extConfigPath,
            "-extensions", "v3_codesign"
        )
        if (-not [string]::IsNullOrWhiteSpace($passphrase)) {
            $env:STARCHILD_TAURI_CA_KEY_PASSPHRASE = $passphrase
            $x509Args += @("-passin", "env:STARCHILD_TAURI_CA_KEY_PASSPHRASE")
        }

        try {
            Invoke-OpenSSL -OpenSSLPath $OpenSSLPath -Arguments $x509Args
        }
        finally {
            if ($null -ne $passphrase) {
                Remove-Item Env:STARCHILD_TAURI_CA_KEY_PASSPHRASE -ErrorAction SilentlyContinue
            }
        }

        $issuedLeaf = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new($leafCertPath)
        $state = [ordered]@{
            createdAt = (Get-Date).ToString("o")
            caThumbprint = $caThumbprint
            leafSubject = $leafSubject
            leafThumbprint = $issuedLeaf.Thumbprint
            leafNotAfter = $issuedLeaf.NotAfter.ToString("o")
        }
        $state | ConvertTo-Json | Set-Content -LiteralPath $metadataPath -Encoding utf8
        Write-Success "Issued local code-signing certificate $($issuedLeaf.Thumbprint)."
    } else {
        Write-Info "Reusing existing local Windows code-signing certificate."
    }

    $pfxPassword = New-EphemeralPassword
    $pkcs12Args = @(
        "pkcs12",
        "-export",
        "-out", $leafPfxPath,
        "-inkey", $leafKeyPath,
        "-in", $leafCertPath,
        "-certfile", $caCertPath,
        "-passout", "pass:$pfxPassword"
    )
    Invoke-OpenSSL -OpenSSLPath $OpenSSLPath -Arguments $pkcs12Args

    $storageFlags =
        [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::Exportable -bor
        [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::PersistKeySet -bor
        [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::UserKeySet
    $leafCertificateWithPrivateKey = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new(
        $leafPfxPath,
        $pfxPassword,
        $storageFlags
    )
    $leafCertificate = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new($leafCertPath)

    return [pscustomobject]@{
        CACertificate = $caCertificate
        CACertPath = $caCertPath
        LeafCertificate = $leafCertificate
        LeafCertificateWithPrivateKey = $leafCertificateWithPrivateKey
        LeafCertPath = $leafCertPath
        LeafDirectory = $leafDirectory
        LeafPfxPath = $leafPfxPath
    }
}

if (-not $IsWindows) {
    throw "The free Tauri Windows signing flow only runs on Windows."
}

$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Definition
$desktopDirectory = Resolve-Path (Join-Path $scriptDirectory "..")
$repoRoot = Resolve-Path (Join-Path $desktopDirectory "..\..")
$resolvedTargets = @(Get-ResolvedTargets -DesktopDirectory $desktopDirectory -RequestedPaths $FilePath -Discover:$AutoDiscover)
if ($resolvedTargets.Length -eq 0) {
    throw "No Tauri Windows artifacts were found to sign."
}

$openSSLPath = Test-OpenSSLInstallation
$material = Ensure-CodeSigningMaterial `
    -RepoRoot $repoRoot `
    -OpenSSLPath $openSSLPath `
    -LeafCommonName $LeafCommonName `
    -LeafOrganization $LeafOrganization `
    -LeafValidityDays $LeafValidityDays `
    -ForceReissue:$ForceReissue `
    -CertDirectory $CertDirectory

if (-not $SkipTrustStoreInstall) {
    Write-Info "Trusting the local CA and publisher certificate for the current user..."
    Add-CertificateIfMissing `
        -StoreName Root `
        -StoreLocation CurrentUser `
        -Certificate $material.CACertificate
    Add-CertificateIfMissing `
        -StoreName TrustedPublisher `
        -StoreLocation CurrentUser `
        -Certificate $material.LeafCertificate
    Add-CertificateIfMissing `
        -StoreName My `
        -StoreLocation CurrentUser `
        -Certificate $material.LeafCertificateWithPrivateKey
}

$timestampServer = [Environment]::GetEnvironmentVariable("STARCHILD_TAURI_TIMESTAMP_URL")
$signingCertificate = $material.LeafCertificateWithPrivateKey

foreach ($target in $resolvedTargets) {
    $existingSignature = Get-AuthenticodeSignature -LiteralPath $target
    if (
        $existingSignature.Status -eq [System.Management.Automation.SignatureStatus]::Valid -and
        $null -ne $existingSignature.SignerCertificate -and
        $existingSignature.SignerCertificate.Thumbprint -eq $signingCertificate.Thumbprint
    ) {
        Write-Info "Already signed with the local Tauri certificate: $target"
        continue
    }

    if (-not $PSCmdlet.ShouldProcess($target, "Sign with local CA-issued Tauri Windows code-signing certificate")) {
        continue
    }

    Write-Info "Signing $target"
    $signatureParams = @{
        FilePath = $target
        Certificate = $signingCertificate
        HashAlgorithm = "SHA256"
    }
    if (-not [string]::IsNullOrWhiteSpace($timestampServer)) {
        $signatureParams.TimestampServer = $timestampServer
    }

    $result = Set-AuthenticodeSignature @signatureParams
    if ($result.Status -ne [System.Management.Automation.SignatureStatus]::Valid) {
        throw "Signing failed for $target with status '$($result.Status)': $($result.StatusMessage)"
    }

    Write-Success "Signed $target"
}

if (Test-Path -LiteralPath $material.LeafPfxPath) {
    Remove-Item -LiteralPath $material.LeafPfxPath -Force
}

Write-Success "Tauri Windows signing completed."

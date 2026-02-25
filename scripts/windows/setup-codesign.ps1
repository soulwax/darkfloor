# File: scripts/windows/setup-codesign.ps1

<#
.SYNOPSIS
  Create a self-signed code signing certificate for local Windows builds.

.DESCRIPTION
  The Electron build is configured to sign Windows artifacts using a certificate
  with subject name "Starchild" (see `package.json` -> `build.win.signtoolOptions`).

  This script creates that certificate in the current user certificate store and
  (optionally) trusts it for the current user so Authenticode validation succeeds
  on this machine.

  IMPORTANT: A self-signed certificate will NOT be trusted on other machines
  unless you install it into their trust stores (and it will still not bypass
  SmartScreen reputation checks for public distribution).

.PARAMETER Subject
  The Common Name used for the certificate (CN=...). Defaults to "Starchild".

.PARAMETER YearsValid
  Certificate validity in years. Defaults to 5.

.PARAMETER Trust
  If set, copies the certificate into:
    - Cert:\CurrentUser\TrustedPublisher
    - Cert:\CurrentUser\Root

.EXAMPLE
  pwsh -File scripts/windows/setup-codesign.ps1 -Trust
#>

[CmdletBinding()]
param(
  [string]$Subject = "Starchild",
  [int]$YearsValid = 5,
  [switch]$Trust
)

$ErrorActionPreference = "Stop"

if ($env:OS -notlike "*Windows*") {
  throw "This script is Windows-only."
}

$subjectCn = if ($Subject -match "^CN=") { $Subject } else { "CN=$Subject" }

Write-Host "Code signing certificate setup"
Write-Host "  Subject: $subjectCn"
Write-Host "  Store:   Cert:\CurrentUser\My"
Write-Host ""

function Ensure-TrustedCertificate {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Thumbprint
  )

  Write-Host "Ensuring certificate is trusted for current user..."

  $sourcePath = "Cert:\CurrentUser\My\$Thumbprint"
  if (-not (Test-Path -Path $sourcePath)) {
    throw "Certificate not found in Cert:\\CurrentUser\\My ($Thumbprint)"
  }

  $cert = Get-Item -Path $sourcePath
  $tempCer = Join-Path -Path $env:TEMP -ChildPath ("codesign-$Thumbprint.cer")

  try {
    [System.IO.File]::WriteAllBytes(
      $tempCer,
      $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
    )

    foreach ($destStore in @("Cert:\CurrentUser\TrustedPublisher", "Cert:\CurrentUser\Root")) {
      $already = Get-ChildItem -Path $destStore | Where-Object { $_.Thumbprint -eq $Thumbprint } | Select-Object -First 1
      if ($null -eq $already) {
        try {
          Import-Certificate -FilePath $tempCer -CertStoreLocation $destStore | Out-Null
        } catch {
          $storeName = if ($destStore -like "*TrustedPublisher") { "TrustedPublisher" } else { "Root" }
          & certutil.exe -user -addstore $storeName $tempCer | Out-Null
        }

        Write-Host "  + Added to $destStore"
      } else {
        Write-Host "  = Already in $destStore"
      }
    }
  } finally {
    try {
      [System.IO.File]::Delete($tempCer)
    } catch {
      # best-effort cleanup
    }
  }
}

$existing = Get-ChildItem -Path Cert:\CurrentUser\My |
  Where-Object {
    $_.Subject -eq $subjectCn -and
    $_.HasPrivateKey -and
    $_.NotAfter -gt (Get-Date)
  } |
  Sort-Object NotAfter -Descending |
  Select-Object -First 1

if ($null -ne $existing) {
  Write-Host "Found existing certificate:"
  Write-Host "  Thumbprint: $($existing.Thumbprint)"
  Write-Host "  NotAfter:   $($existing.NotAfter)"

  if ($Trust) {
    Write-Host ""
    Ensure-TrustedCertificate -Thumbprint $existing.Thumbprint
  }

  Write-Host ""
  Write-Host "Next:"
  Write-Host "  - Build:   npm run electron:build:win"
  Write-Host "  - Verify:  Get-AuthenticodeSignature dist\\Starchild.exe"
  exit 0
}

Write-Host "Creating new self-signed code signing certificate..."
$cert = New-SelfSignedCertificate `
  -Type CodeSigningCert `
  -Subject $subjectCn `
  -CertStoreLocation "Cert:\CurrentUser\My" `
  -KeyAlgorithm RSA `
  -KeyLength 4096 `
  -HashAlgorithm SHA256 `
  -KeyExportPolicy Exportable `
  -NotAfter (Get-Date).AddYears($YearsValid)

Write-Host "Created:"
Write-Host "  Thumbprint: $($cert.Thumbprint)"
Write-Host "  NotAfter:   $($cert.NotAfter)"

if ($Trust) {
  Write-Host ""
  Ensure-TrustedCertificate -Thumbprint $cert.Thumbprint
}

Write-Host ""
Write-Host "Next:"
Write-Host "  - Build:   npm run electron:build:win"
Write-Host "  - Verify:  Get-AuthenticodeSignature dist\\Starchild.exe"

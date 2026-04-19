# File: scripts/windows/verify-electron-close.ps1

<#
.SYNOPSIS
  Verify the packaged Electron app fully exits after its window is closed.

.DESCRIPTION
  This script is intended for the Windows NSIS installer smoke path. It launches
  the installed Starchild executable, closes the main window, waits for the main
  process to exit, and checks for lingering Starchild or bundled node.exe
  processes rooted under the installation directory.

  Use -RunInstallerCheck to rerun the NSIS installer after the close check. That
  final step is the closest automated signal for "the installer no longer
  reports the app as running after the window has been closed."

.EXAMPLE
  pnpm electron:verify:win-close

.EXAMPLE
  pnpm electron:verify:win-close -- -RunInstallerCheck

.EXAMPLE
  pwsh -ExecutionPolicy Bypass -File scripts/windows/verify-electron-close.ps1 `
    -ExePath "$env:LOCALAPPDATA\Programs\Starchild\Starchild.exe" `
    -InstallerPath ".\dist\Starchild_setup.exe" `
    -RunInstallerCheck
#>

[CmdletBinding()]
param(
  [string]$ExePath,
  [string]$InstallerPath,
  [string[]]$InstallerArguments = @("/S"),
  [int]$StartupTimeoutSeconds = 60,
  [int]$ExitTimeoutSeconds = 25,
  [int]$InstallerTimeoutSeconds = 180,
  [switch]$RunInstallerCheck,
  [switch]$ForceKillOnFailure
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ($env:OS -notlike "*Windows*") {
  throw "This verification script is Windows-only."
}

$scriptPath = if ($PSCommandPath) { $PSCommandPath } else { $MyInvocation.MyCommand.Path }
$repoRoot = Resolve-Path -LiteralPath (Join-Path -Path (Split-Path -Parent $scriptPath) -ChildPath "..\..")

function Write-Step {
  param([string]$Message)
  Write-Host "[electron:verify:win-close] $Message" -ForegroundColor Cyan
}

function Write-Success {
  param([string]$Message)
  Write-Host "[electron:verify:win-close] $Message" -ForegroundColor Green
}

function Write-Warn {
  param([string]$Message)
  Write-Host "[electron:verify:win-close] $Message" -ForegroundColor Yellow
}

function Resolve-FirstExistingFile {
  param([string[]]$Candidates)

  foreach ($candidate in $Candidates) {
    if ([string]::IsNullOrWhiteSpace($candidate)) {
      continue
    }

    if (Test-Path -LiteralPath $candidate -PathType Leaf) {
      return (Resolve-Path -LiteralPath $candidate).Path
    }
  }

  return $null
}

function Test-IsPathUnder {
  param(
    [string]$CandidatePath,
    [string]$RootPath
  )

  if ([string]::IsNullOrWhiteSpace($CandidatePath) -or [string]::IsNullOrWhiteSpace($RootPath)) {
    return $false
  }

  try {
    $resolvedCandidate = [System.IO.Path]::GetFullPath($CandidatePath).TrimEnd('\')
    $resolvedRoot = [System.IO.Path]::GetFullPath($RootPath).TrimEnd('\')
    return $resolvedCandidate.StartsWith($resolvedRoot, [System.StringComparison]::OrdinalIgnoreCase)
  } catch {
    return $false
  }
}

function Get-StarchildProcessRows {
  param(
    [string]$InstallRoot,
    [int[]]$ProcessIds = @()
  )

  $processIdSet = [System.Collections.Generic.HashSet[int]]::new()
  foreach ($id in $ProcessIds) {
    [void]$processIdSet.Add($id)
  }

  Get-CimInstance Win32_Process |
    Where-Object {
      $name = $_.Name
      if ($name -notin @("Starchild.exe", "node.exe", "electron.exe")) {
        return $false
      }

      if ($processIdSet.Contains([int]$_.ProcessId)) {
        return $true
      }

      $executablePath = [string]$_.ExecutablePath
      $commandLine = [string]$_.CommandLine

      (Test-IsPathUnder -CandidatePath $executablePath -RootPath $InstallRoot) -or
        ($commandLine -like "*$InstallRoot*")
    } |
    Sort-Object Name, ProcessId
}

function Format-ProcessRow {
  param($ProcessRow)

  $path = if ([string]::IsNullOrWhiteSpace([string]$ProcessRow.ExecutablePath)) {
    "<unknown path>"
  } else {
    [string]$ProcessRow.ExecutablePath
  }

  return "PID $($ProcessRow.ProcessId) $($ProcessRow.Name) $path"
}

$exeCandidates = @(
  $ExePath,
  (Join-Path -Path $repoRoot -ChildPath "dist\win-unpacked\Starchild.exe"),
  (Join-Path -Path $env:LOCALAPPDATA -ChildPath "Programs\Starchild\Starchild.exe"),
  (Join-Path -Path $env:ProgramFiles -ChildPath "Starchild\Starchild.exe"),
  (Join-Path -Path ${env:ProgramFiles(x86)} -ChildPath "Starchild\Starchild.exe")
)

$resolvedExePath = Resolve-FirstExistingFile -Candidates $exeCandidates
if ($null -eq $resolvedExePath) {
  throw "Could not find Starchild.exe. Pass -ExePath or install/build the Windows app first."
}

$installRoot = Split-Path -Parent $resolvedExePath

Write-Step "Executable: $resolvedExePath"
Write-Step "Install root: $installRoot"

$preExisting = @(Get-StarchildProcessRows -InstallRoot $installRoot)
if ($preExisting.Count -gt 0) {
  Write-Warn "Found existing Starchild-related processes before launch:"
  foreach ($row in $preExisting) {
    Write-Warn "  $(Format-ProcessRow -ProcessRow $row)"
  }
  throw "Close the existing app/processes before running this verification."
}

Write-Step "Launching packaged app..."
$appProcess = Start-Process -FilePath $resolvedExePath -PassThru
$deadline = (Get-Date).AddSeconds($StartupTimeoutSeconds)
$hasWindow = $false

while ((Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 500
  $appProcess.Refresh()

  if ($appProcess.HasExited) {
    throw "Starchild exited before a main window appeared. Exit code: $($appProcess.ExitCode)"
  }

  if ($appProcess.MainWindowHandle -ne 0) {
    $hasWindow = $true
    break
  }
}

if (-not $hasWindow) {
  if ($ForceKillOnFailure) {
    Stop-Process -Id $appProcess.Id -Force -ErrorAction SilentlyContinue
  }
  throw "Timed out waiting for the Starchild main window after $StartupTimeoutSeconds seconds."
}

Write-Step "Closing the main window..."
[void]$appProcess.CloseMainWindow()

if (-not $appProcess.WaitForExit($ExitTimeoutSeconds * 1000)) {
  if ($ForceKillOnFailure) {
    Write-Warn "App did not exit in time. Force killing PID $($appProcess.Id)."
    Stop-Process -Id $appProcess.Id -Force -ErrorAction SilentlyContinue
  }

  throw "Starchild did not exit within $ExitTimeoutSeconds seconds after CloseMainWindow()."
}

Start-Sleep -Seconds 2

$lingering = @(Get-StarchildProcessRows -InstallRoot $installRoot -ProcessIds @($appProcess.Id))
if ($lingering.Count -gt 0) {
  Write-Warn "Found lingering Starchild-related processes:"
  foreach ($row in $lingering) {
    Write-Warn "  $(Format-ProcessRow -ProcessRow $row)"
  }

  if ($ForceKillOnFailure) {
    foreach ($row in $lingering) {
      Stop-Process -Id ([int]$row.ProcessId) -Force -ErrorAction SilentlyContinue
    }
  }

  throw "The packaged app left processes running after the window was closed."
}

Write-Success "App closed cleanly and no install-root processes remain."

if ($RunInstallerCheck) {
  $installerCandidates = @(
    $InstallerPath,
    (Join-Path -Path $repoRoot -ChildPath "dist\Starchild_setup.exe")
  )
  $resolvedInstallerPath = Resolve-FirstExistingFile -Candidates $installerCandidates

  if ($null -eq $resolvedInstallerPath) {
    throw "Could not find the NSIS installer. Pass -InstallerPath or run pnpm electron:build:win first."
  }

  Write-Step "Running NSIS installer check: $resolvedInstallerPath $($InstallerArguments -join ' ')"
  $installerProcess = Start-Process `
    -FilePath $resolvedInstallerPath `
    -ArgumentList $InstallerArguments `
    -PassThru

  if (-not $installerProcess.WaitForExit($InstallerTimeoutSeconds * 1000)) {
    if ($ForceKillOnFailure) {
      Stop-Process -Id $installerProcess.Id -Force -ErrorAction SilentlyContinue
    }

    throw "NSIS installer did not exit within $InstallerTimeoutSeconds seconds."
  }

  if ($installerProcess.ExitCode -ne 0) {
    throw "NSIS installer exited with code $($installerProcess.ExitCode)."
  }

  Write-Success "NSIS installer completed after app close."
}

Write-Success "Windows close verification passed."

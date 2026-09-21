param(
  [string]$Executable,
  [string]$Installer,
  [int]$TimeoutSeconds = 90,
  [switch]$RunInteractiveSmoke
)

$ErrorActionPreference = "Stop"
if ([string]::IsNullOrEmpty($Executable) -eq [string]::IsNullOrEmpty($Installer)) {
  throw "Pass exactly one of -Executable or -Installer."
}

$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("lyceum-win7-smoke-" + [Guid]::NewGuid().ToString("N"))
try {
  if (-not [string]::IsNullOrEmpty($Installer)) {
    $resolvedInstaller = (Resolve-Path $Installer).Path
    $installDirectory = Join-Path $testRoot "installed"
    $installTargetArgument = '/D="' + $installDirectory + '"'
    $installProcess = Start-Process -FilePath $resolvedInstaller `
      -ArgumentList "/S",$installTargetArgument `
      -PassThru
    if (-not $installProcess.WaitForExit($TimeoutSeconds * 1000)) {
      Stop-Process -Id $installProcess.Id -Force
      throw "Lyceum installer did not finish within $TimeoutSeconds seconds."
    }
    if ($installProcess.ExitCode -ne 0) {
      throw "Lyceum installer exited with code $($installProcess.ExitCode)."
    }
    $resolvedExecutable = Join-Path $installDirectory "Lyceum.exe"
    if (-not (Test-Path $resolvedExecutable)) {
      throw "Installer completed but Lyceum.exe is missing from $installDirectory."
    }
  } else {
    $resolvedExecutable = (Resolve-Path $Executable).Path
  }

  $resources = Join-Path (Split-Path $resolvedExecutable -Parent) "resources"
  $asar = Join-Path $resources "app.asar"
  if (-not (Test-Path $asar) -or (Get-Item $asar).Length -le 0) {
    throw "Installed application is missing a non-empty resources\\app.asar."
  }
  $unpackedNodeModules = Join-Path $resources "app.asar.unpacked\\node_modules"
  $nativeFiles = @(Get-ChildItem $unpackedNodeModules -Recurse -Filter "*.node" -ErrorAction Stop | ForEach-Object { $_.FullName })
  foreach ($requiredPathPart in @("better-sqlite3", "sharp", "@napi-rs")) {
    if (-not ($nativeFiles | Where-Object { $_ -like "*$requiredPathPart*" })) {
      throw "Installed application is missing the required native runtime: $requiredPathPart"
    }
  }

  if ($RunInteractiveSmoke) {
    $userData = Join-Path $testRoot "user-data"
    $report = Join-Path $testRoot "report.json"
    New-Item -ItemType Directory -Path $userData -Force | Out-Null
    $previousReport = $env:LYCEUM_SMOKE_TEST_REPORT
    $previousSmokeTest = $env:LYCEUM_SMOKE_TEST
    $env:LYCEUM_SMOKE_TEST_REPORT = $report
    $env:LYCEUM_SMOKE_TEST = "1"
    try {
      $userDataArgument = '--user-data-dir="' + $userData + '"'
      $process = Start-Process -FilePath $resolvedExecutable -ArgumentList $userDataArgument -PassThru
      if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
        Stop-Process -Id $process.Id -Force
        throw "Lyceum did not finish its interactive compatibility smoke test within $TimeoutSeconds seconds."
      }
      if ($process.ExitCode -ne 0 -or -not (Test-Path $report)) {
        throw "Lyceum interactive compatibility smoke test failed."
      }
      $reportText = [System.IO.File]::ReadAllText($report)
      if ($reportText -notmatch '"ok"\s*:\s*true') {
        throw "Lyceum reported a failed interactive compatibility test: $reportText"
      }
    } finally {
      $env:LYCEUM_SMOKE_TEST_REPORT = $previousReport
      $env:LYCEUM_SMOKE_TEST = $previousSmokeTest
    }
  }
  Write-Host "Windows Legacy installer integrity check passed: executable, app.asar and native runtimes are present."
} finally {
  $uninstaller = Join-Path $testRoot "installed\Uninstall Lyceum.exe"
  if (Test-Path $uninstaller) {
    $uninstallProcess = Start-Process -FilePath $uninstaller -ArgumentList "/S" -PassThru
    if (-not $uninstallProcess.WaitForExit($TimeoutSeconds * 1000)) {
      Stop-Process -Id $uninstallProcess.Id -Force
      Write-Warning "Lyceum uninstaller timed out during smoke-test cleanup."
    }
  }
  if (Test-Path $testRoot) {
    try {
      Remove-Item -Path $testRoot -Recurse -Force
    } catch {
      Write-Warning "Could not remove smoke-test directory $testRoot`: $_"
    }
  }
}

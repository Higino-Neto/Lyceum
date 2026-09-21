param(
  [string]$Executable,
  [string]$Installer,
  [int]$TimeoutSeconds = 90
)

$ErrorActionPreference = "Stop"
if ([string]::IsNullOrEmpty($Executable) -eq [string]::IsNullOrEmpty($Installer)) {
  throw "Pass exactly one of -Executable or -Installer."
}

$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("lyceum-win7-smoke-" + [Guid]::NewGuid().ToString("N"))
$userData = Join-Path $testRoot "user-data"
$report = Join-Path $testRoot "report.json"
New-Item -ItemType Directory -Path $userData -Force | Out-Null

$previousReport = $env:LYCEUM_SMOKE_TEST_REPORT
$env:LYCEUM_SMOKE_TEST_REPORT = $report
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

  $userDataArgument = '--user-data-dir="' + $userData + '"'
  $process = Start-Process -FilePath $resolvedExecutable `
    -ArgumentList "--lyceum-smoke-test",$userDataArgument `
    -PassThru

  if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
    Stop-Process -Id $process.Id -Force
    if (Test-Path $report) {
      $reportText = [System.IO.File]::ReadAllText($report)
      throw "Lyceum did not finish its compatibility smoke test within $TimeoutSeconds seconds. Last report: $reportText"
    }
    throw "Lyceum did not finish its compatibility smoke test within $TimeoutSeconds seconds."
  }
  if ($process.ExitCode -ne 0) {
    if (Test-Path $report) {
      $reportText = [System.IO.File]::ReadAllText($report)
      throw "Lyceum compatibility smoke test exited with code $($process.ExitCode). Report: $reportText"
    }
    throw "Lyceum compatibility smoke test exited with code $($process.ExitCode)."
  }
  if (-not (Test-Path $report)) {
    throw "Lyceum did not write the compatibility report."
  }

  $reportText = [System.IO.File]::ReadAllText($report)
  if ($reportText -notmatch '"ok"\s*:\s*true') {
    throw "Lyceum reported a failed compatibility test: $reportText"
  }
  Write-Host "Windows compatibility smoke test passed: $reportText"
} finally {
  $env:LYCEUM_SMOKE_TEST_REPORT = $previousReport
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

# Fail if Device Cloud UI/backend is missing from the working tree (V02 safeguard).
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$failures = @()

if (-not (Test-Path "index.html")) {
  $failures += "index.html ausente"
} else {
  $n = (Select-String -Path "index.html" -Pattern "device-cloud-stage" -SimpleMatch | Measure-Object).Count
  if ($n -lt 1) {
    $failures += "index.html sem device-cloud-stage (menu Dispositivos sumiu)"
  }
}

if (-not (Test-Path "src/device-cloud/waba-device-cloud.routes.ts")) {
  $failures += "src/device-cloud/waba-device-cloud.routes.ts ausente"
}

$branch = (git rev-parse --abbrev-ref HEAD 2>$null)
if ($branch -eq "v02") {
  Write-Host "branch=v02 OK"
}

if ($failures.Count -gt 0) {
  Write-Host "ERRO: Device Cloud incompleto na working tree:" -ForegroundColor Red
  $failures | ForEach-Object { Write-Host " - $_" -ForegroundColor Red }
  Write-Host "Nao faca checkout para outra branch. Restaure Device Cloud antes de continuar." -ForegroundColor Yellow
  exit 1
}

Write-Host "Device Cloud presente (index.html + src/device-cloud)." -ForegroundColor Green
exit 0

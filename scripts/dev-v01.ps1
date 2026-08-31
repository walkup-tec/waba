# WABA V01 — baseline (espelho do estado atual de produção)
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

if (-not (Test-Path ".env.v01")) {
  Write-Host "Crie .env.v01 a partir de .env.v01.example antes de continuar." -ForegroundColor Yellow
  exit 1
}

& (Join-Path $PSScriptRoot "free-port.ps1") -Port 3011

$env:WABA_ENV = "v01"
Write-Host ""
Write-Host "V01 (menu completo): http://localhost:3011/version-01/" -ForegroundColor Cyan
Write-Host ""
npm run dev:v01:run

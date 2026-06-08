# WABA V01 — baseline (espelho do estado atual de produção)
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

if (-not (Test-Path ".env.v01")) {
  Write-Host "Crie .env.v01 a partir de .env.v01.example antes de continuar." -ForegroundColor Yellow
  exit 1
}

$env:WABA_ENV = "v01"
npm run dev:v01:run

# WABA V02 — desenvolvimento ativo (alterações diárias)
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

if (-not (Test-Path ".env.v02")) {
  Write-Host "Crie .env.v02 a partir de .env.v02.example antes de continuar." -ForegroundColor Yellow
  exit 1
}

$env:WABA_ENV = "v02"
npm run dev:v02:run

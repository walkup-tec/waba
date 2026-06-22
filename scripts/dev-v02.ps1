# WABA V02 — desenvolvimento ativo (alterações diárias)
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

if (-not (Test-Path ".env.v02")) {
  Write-Host "Crie .env.v02 a partir de .env.v02.example antes de continuar." -ForegroundColor Yellow
  exit 1
}

& (Join-Path $PSScriptRoot "free-port.ps1") -Port 3012

Write-Host "Sincronizando instancias Mozart = Walkup (producao)..." -ForegroundColor DarkGray
try {
  node (Join-Path $PSScriptRoot "sync-mozart-instances-walkup-prod-v02.cjs")
} catch {
  Write-Host "Aviso: sync Mozart/Walkup falhou (continua com dados locais)." -ForegroundColor Yellow
}

$env:WABA_ENV = "v02"
Write-Host ""
Write-Host "V02 (UI igual producao): http://localhost:3012/version-02/" -ForegroundColor Cyan
Write-Host "Health: http://localhost:3012/version-02/health  (uiProfile=production)" -ForegroundColor DarkGray
Write-Host ""
npm run dev:v02:run

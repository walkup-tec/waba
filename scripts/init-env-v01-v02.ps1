# Cria .env.v01 e .env.v02 a partir dos exemplos (sem sobrescrever existentes)
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

foreach ($pair in @(@("v01", ".env.v01"), @("v02", ".env.v02"))) {
  $name = $pair[0]
  $target = $pair[1]
  $example = "$target.example"
  if (Test-Path $target) {
    Write-Host "[skip] $target já existe"
    continue
  }
  if (-not (Test-Path $example)) {
    Write-Host "[erro] $example não encontrado" -ForegroundColor Red
    exit 1
  }
  Copy-Item $example $target
  Write-Host "[ok] $target criado a partir de $example"
}

New-Item -ItemType Directory -Force -Path "data\v01" | Out-Null
New-Item -ItemType Directory -Force -Path "data\v02" | Out-Null
Write-Host "[ok] pastas data\v01 e data\v02 prontas"

param(
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$dest = "H:\Meu Drive\Drive Profissional\Waba"
$patchScript = "C:\Users\Usuario\.cursor\projects\e-Waba\patch-waba\apply-uptime-diagnose-patch.ps1"

Write-Host "=== WABA: clone Git -> H: ===" -ForegroundColor Cyan
Write-Host "Destino: $dest"

if (Test-Path $dest) {
  Write-Host "Removendo pasta existente..."
  Remove-Item -LiteralPath $dest -Recurse -Force
}

New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
git clone https://github.com/walkup-tec/waba.git $dest
if (-not (Test-Path (Join-Path $dest "package.json"))) {
  throw "Clone falhou — package.json ausente."
}

Set-Location $dest

if (Test-Path $patchScript) {
  Write-Host "Aplicando patch Diagnostico Uptime..."
  & $patchScript -RepoRoot $dest
} else {
  Write-Host "Patch script nao encontrado — pulando."
}

npm config set cache "$env:USERPROFILE\npm-cache" --global
npm install

if (-not $SkipBuild) {
  npm run build:h
}

# Limpar copia em C: se existir
$cCopy = "C:\Users\Usuario\Waba"
if (Test-Path $cCopy) {
  Write-Host "Removendo copia antiga em C: ($cCopy)..."
  Remove-Item -LiteralPath $cCopy -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Pronto. Abra no Cursor:" -ForegroundColor Green
Write-Host "  $dest"

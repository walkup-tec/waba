# Aplica o atendimento Meta no master local e envia para o GitHub.
# EasyPanel (waba_disparador) so faz deploy a partir de github.com/walkup-tec/waba master.
#
# Uso (no Windows, pasta Waba-master-welcome):
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\push-atendimento-github.ps1
#
# O arquivo scripts\deploy-atendimento-meta.patch precisa estar nesta pasta
# (Cursor as vezes salva como .js — o script aceita os dois se o conteudo for um patch git).

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$candidates = @(
  ".\scripts\deploy-atendimento-meta.patch",
  ".\scripts\deploy-atendimento-meta.patch.js",
  ".\scripts\deploy-atendimento-meta.js",
  "$env:USERPROFILE\Downloads\deploy-atendimento-meta.patch",
  "$env:USERPROFILE\Downloads\deploy-atendimento-meta.patch.js"
)

$patch = $null
foreach ($path in $candidates) {
  if (Test-Path $path) {
    $first = Get-Content -Path $path -TotalCount 1 -ErrorAction SilentlyContinue
    if ($first -like "From *") {
      $patch = (Resolve-Path $path).Path
      break
    }
  }
}

if (-not $patch) {
  Write-Error @"
Nao achei o patch do atendimento.
Copie deploy-atendimento-meta.patch para:
  $((Get-Location).Path)\scripts\
NAO use o arquivo antigo meta-cloud-lab-from-select (esse ja esta no GitHub).
"@
}

Write-Host "Repo:  $((Get-Location).Path)"
Write-Host "Patch: $patch"
git --no-pager log -1 --oneline
git --no-pager remote -v

git am $patch
if ($LASTEXITCODE -ne 0) {
  Write-Error "git am falhou. Se o patch ja tiver sido aplicado, rode: git log --oneline -5"
}

Write-Host "Enviando para origin/master (GitHub)..."
git push origin master
if ($LASTEXITCODE -ne 0) {
  Write-Error "Push falhou. Confira o Git Credential Manager / PAT (Contents: Read and write no repo waba)."
}

Write-Host "OK. EasyPanel deve detectar o push em master."
Write-Host "Depois do Redeploy, GET /health deve mostrar:"
Write-Host "  DEPLOY-2026-09-01-001200-meta-atendimento-chat"
git --no-pager log -3 --oneline

# WABA no Google Drive (H:)

## Caminho canônico

```
H:\Meu Drive\Drive Profissional\Waba
```

## Montar a partir do Git

```powershell
$dest = "H:\Meu Drive\Drive Profissional\Waba"
if (Test-Path $dest) { Remove-Item -LiteralPath $dest -Recurse -Force }
git clone https://github.com/walkup-tec/waba.git $dest
cd $dest
npm config set cache "$env:USERPROFILE\npm-cache" --global
npm install
npm run build:h
```

**Importante:** o Google Drive (`H:`) não suporta `node_modules` (não é NTFS local). O script `npm run build:h` instala dependências em `%USERPROFILE%\.waba-h-deps` no disco `C:` e compila o código em `H:`.

## Build no H: (recomendado)

```powershell
cd "H:\Meu Drive\Drive Profissional\Waba"
npm run build:h
```

## Patch Diagnóstico Uptime (se necessário)

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\Usuario\.cursor\projects\e-Waba\patch-waba\apply-uptime-diagnose-patch.ps1" -RepoRoot "H:\Meu Drive\Drive Profissional\Waba"
```

## Cursor

**File → Open Folder** → `H:\Meu Drive\Drive Profissional\Waba`

## Política de unidades

| Unidade | Uso |
|---------|-----|
| **H:** | Workspace principal (Google Drive) |
| **E:** / **D:** | Backup / espelho quando disponíveis |
| **C:** | Não usar para o projeto |

## .env

Copie `.env.v02.example` ou sincronize `.env` do ambiente de produção — **não commitar**.

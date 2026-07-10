# LOG — 2026-07-09 — Montagem WABA no Google Drive (H:)

## Contexto

Usuário iniciou exclusão da unidade `C:` e pediu montar o projeto WABA a partir do Git na unidade **H:** (`Google Drive`).

## Ações executadas

1. **Clone Git** em `H:\Meu Drive\Drive Profissional\Waba` (origin `walkup-tec/waba`, branch `master`).
2. **Patch Diagnóstico Uptime** aplicado:
   - `src/monitoring/uptime-playbooks.ts`
   - `src/monitoring/uptime-monitor-diagnostics.service.ts`
   - `src/admin/waba-admin.routes.ts` (rota `POST /admin/infra/uptime-monitor/diagnose`)
   - `index.html` (UI `canRunUptimeDiagnosticUi`, modal, botão em luzes vermelhas)
3. **Build no H:** — `npm install` direto no Google Drive falha (volume não NTFS local; erros `TAR_ENTRY_ERROR`, junction impossível). Solução:
   - `.npmrc` com cache em `C:\Users\Usuario\npm-cache`
   - `scripts/build-with-local-deps.cjs` + `npm run build:h` — deps em `%USERPROFILE%\.waba-h-deps`
4. **Documentação:** `doc/SETUP-H-DRIVE.md`, `scripts/setup-waba-on-h.ps1`
5. **Build validado:** `npm run build:h` → OK (tsc + dist/index.html)

## Arquivos criados/alterados

| Arquivo | Alteração |
|---------|-----------|
| `H:\Meu Drive\Drive Profissional\Waba\` | Clone completo do repositório |
| `src/monitoring/uptime-*.ts` | Novos (diagnóstico) |
| `src/admin/waba-admin.routes.ts` | Rota diagnose |
| `index.html` | UI diagnóstico uptime |
| `package.json` | Script `build:h` |
| `.npmrc` | Cache npm local |
| `scripts/build-with-local-deps.cjs` | Build com deps em C: |
| `scripts/setup-waba-on-h.ps1` | Setup automatizado |
| `doc/SETUP-H-DRIVE.md` | Guia H: |

## Como validar

```powershell
cd "H:\Meu Drive\Drive Profissional\Waba"
git status
npm run build:h
```

Abrir no Cursor: **File → Open Folder** → `H:\Meu Drive\Drive Profissional\Waba`

## Observações

- **Não usar `C:\Users\Usuario\Waba`** como workspace — cópia antiga ainda pode existir até exclusão manual.
- **node_modules** não deve ficar no H:; usar sempre `npm run build:h` ou deps em `%USERPROFILE%\.waba-h-deps`.
- **`.env`**: copiar de backup/produção; não commitar.
- Alterações locais ainda **não commitadas** (aguardar pedido do usuário).

## Palavras-chave

`google-drive`, `H-drive`, `waba-h-deps`, `build:h`, `npm TAR_ENTRY_ERROR`, `clone git H`, `uptime diagnose`

## Pendências

- [ ] Usuário abrir workspace Cursor em `H:\Meu Drive\Drive Profissional\Waba`
- [ ] Remover `C:\Users\Usuario\Waba` quando exclusão em C: terminar
- [ ] Sincronizar `.env` se necessário
- [ ] Commit/deploy quando solicitado

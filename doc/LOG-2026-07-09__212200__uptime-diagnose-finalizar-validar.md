# LOG — 2026-07-09 — Uptime diagnose finalizado e validado

## Contexto

Usuário escolheu retomar pelo item 1: **finalizar e testar** o Diagnóstico Uptime Monitor.

## O que a feature faz

- **UI:** botão «Diagnóstico» nas luzes vermelhas do header (somente master `walkup@walkuptec.com.br`).
- **API:** `POST /admin/infra/uptime-monitor/diagnose` com `{ targetKey, execute? }`.
- **Backend:** checagem fresh das luzes + playbook por alvo (`uptime-playbooks.ts`); Asaas inclui `health` in-app; SSH remoto opcional com allowlist.

## Fix aplicado

**Asaas lento no diagnóstico:** `buildInAppDiagnostics` chamava `runAsaasIntegrationMonitorCheck({ skipState: true })`, que ainda disparava alertas WhatsApp (15 rodadas). Substituído por **apenas** `evaluateAsaasIntegrationHealth()` — diagnóstico passou de ~40s para ~1,5s no verify.

## Validação

```powershell
cd "H:\Meu Drive\Drive Profissional\Waba"
npm run build:h          # tsc OK; copy-index-html pode falhar EPERM no Drive ocasionalmente
npm run verify:uptime-diagnose
```

Resultado verify (sem .env produção):

| Alvo | Luz | Passos |
|------|-----|--------|
| site_bet | OK | 4 |
| site_disparos | OK | 4 |
| app_waba | OK | 3 |
| site_drax | OK | 2 |
| asaas_webhook | DOWN (env local) | 2 |
| evo_api | DOWN (env local) | 3 |

## Teste manual (V02 ou produção)

1. Login master como `walkup@walkuptec.com.br`
2. Aguardar luzes no header (Admin)
3. Se alguma luz vermelha → clicar **Diagnóstico**
4. Modal: status, hints, JSON Asaas (se aplicável), playbook com **Copiar comando**
5. Executar comandos no VPS via SSH (modo padrão)

Execução remota automática (opcional, produção):

```env
WABA_UPTIME_DIAGNOSTIC_EXEC=1
WABA_UPTIME_DIAGNOSTIC_SSH_HOST=srv1261237.hstgr.cloud
WABA_UPTIME_DIAGNOSTIC_SSH_USER=root
```

POST com `{ "targetKey": "site_bet", "execute": true }`.

## Arquivos alterados

- `src/monitoring/uptime-monitor-diagnostics.service.ts` — fix Asaas
- `scripts/verify-uptime-diagnose.cjs` — novo
- `package.json` — script `verify:uptime-diagnose`
- `.env.example` — vars diagnóstico

## Pendências

- [ ] Teste UI no V02 (`npm run dev:v02`) — usuário
- [ ] Commit + deploy quando solicitado
- [ ] Build EPERM no Google Drive: se `copy-index-html` falhar, repetir build ou copiar `index.html` → `dist/` manualmente

## Palavras-chave

`uptime diagnose`, `playbook`, `walkup@walkuptec.com.br`, `verify:uptime-diagnose`, `asaas health only`

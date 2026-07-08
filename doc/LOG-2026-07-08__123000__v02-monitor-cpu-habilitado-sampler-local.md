# LOG — 2026-07-08 — V02 Monitor CPU habilitado + sampler local

## Sintoma
UI Monitor CPU no V02: "Falha ao carregar." / "Monitor CPU desativado neste ambiente." Sem gráfico/indicadores.

## Causa
1. `VpsCpuMonitorService.isEnabled()` retorna **false** para `WABA_ENV=v01|v02` salvo flag explícita.
2. Mesmo habilitado, amostras vêm do coletor no VPS (`cpu-samples.jsonl`). Localmente o arquivo não existia.

## Correção
- `.env.v02` + `.env.v02.example`: `WABA_VPS_CPU_MONITOR_ENABLED=true` + `WABA_VPS_CPU_LOCAL_SAMPLER=true`
- `startVpsCpuLocalSampler()` em `src/index.ts` — amostra host via `os` a cada 60s → `data/v02/vps-infra/cpu-samples.jsonl`
- Reinício `npm run dev:v02` — log: `[vps-cpu] sampler local ativo`
- Primeira amostra OK (ex.: CPU ~18%, mem ~95% local)

## Validar
1. Hard refresh http://localhost:3012/version-02/
2. Master → Suporte → Monitor CPU
3. Cards + gráfico + barras devem aparecer (dados da máquina local, não do VPS produção)

## Palavras-chave
monitor cpu v02 desativado, local sampler, cpu-samples.jsonl, WABA_VPS_CPU_MONITOR_ENABLED

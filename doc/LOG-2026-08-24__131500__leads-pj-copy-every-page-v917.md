# LOG — Leads PJ: copiar todos os CNPJs de cada página (v9.17)

## Contexto

O robô deve copiar **todos os CNPJs de cada página** por onde passa (~20/página).
Sintoma: UI com centenas de “páginas” e só ~980 CNPJs (~49 páginas reais) —
checkpoint avançava sem volume de CNPJs correspondente (pulava páginas).

## Solução

1. **Piso pelo pool** — `resumeFloorPage = floor(pending/20)+1`. Se checkpoint ≫ piso,
   retoma do piso (não pula páginas ainda sem arquivar).
2. **Boot / estimatePortalResumePage** — mesma regra (checkpoint inflado → volume).
3. **Métricas UI** — `pagesDone` não exibe checkpoint inflado; usa `ceil(cnpjs/20)` quando inconsistente.
4. **COPY loop** — se há cards na tela e 0 CNPJ parseável, relê e **não avança** checkpoint
   (erro soft → recover). Todo CNPJ mapeado da página vai ao `pageLeads` (merge com dedupe).

## Arquivos

- `src/marketing/leads-cnpj/waba-leads-cnpj-casadosdados.adapter.ts`
- `src/marketing/leads-cnpj/waba-leads-cnpj.service.ts`
- `src/deploy-marker.ts` → `DEPLOY-2026-08-24-1315-leads-pj-copy-every-page-v9.17`

## Validar

- Páginas na UI ≈ CNPJs/20 (±2).
- Progresso: `COPY: página N arquivada — +X novos / Y CNPJ(s) / Z cards`.
- Após crash com checkpoint alto e pool baixo: mensagem de checkpoint inconsistente e retomada no piso.

## Palavras-chave

leads-pj, copy-every-page, checkpoint-inflado, resumeFloorPage, v9.17

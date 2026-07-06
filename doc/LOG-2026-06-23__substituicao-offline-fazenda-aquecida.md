# LOG — Substituição automática offline (Fazenda + aquecimento)

**Data:** 2026-06-23

## Contexto

Regra de negócio para números comprados (API Alternativa):

1. **Na campanha:** se um número selecionado fica offline, substituir pelo mais aquecido disponível na Fazenda (`use_fazenda`) e manter enviando.
2. **Fora da campanha:** número comprado/ativado mas não selecionado — se ficar offline, também repor pelo mais aquecido, mas **sem** entrar nos envios da campanha (só vinculado).

Instrução resumida no card «Seus números disponíveis».

## Solução backend (`src/index.ts`)

- `resolveWarmFazendaReplacementsForAuth` — candidatos da pool Fazenda conectados, ordenados por `warmthLevel`.
- `applyPurchasedNumberReplacement` — `markBlocked` + `register` com `replacesInstanceName`.
- `tryAutoReplenishCampaignInstances` — substitui **todos** os selecionados offline (não só ≥50%); depois completa mínimo conectado.
- `tryAutoReplenishOfflinePurchasedActivations` — ativações ativas offline **fora** da seleção da campanha; roda a cada tick de disparo.
- `campaignNeedsInstanceReplenish` — dispara reposição também com 1 offline entre selecionados.

## Repositório

- `AlternativaNumberActivationRepository.listSubscriberEmails()` — iterar assinantes com ativações.

## UI (`index.html`)

- Bloco `.alt-fazenda-replacement-hint` acima da lista de cards.

## Arquivos

- `src/index.ts`
- `src/billing/alternativa-number-activation.repository.ts`
- `index.html`

## Validação

```powershell
cd D:\Waba-master
npm run build
```

## Palavras-chave

`tryAutoReplenishOfflinePurchasedActivations`, `resolveWarmFazendaReplacementsForAuth`, `alt-fazenda-replacement-hint`, fazenda offline replacement

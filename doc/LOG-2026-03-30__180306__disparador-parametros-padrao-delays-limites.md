# LOG — Parâmetros padrão do disparador (delays e limites)

## Contexto (resumo)

Ajuste dos **valores padrão** do Waba disparador para:
- Delay mínimo: **120** s  
- Delay máximo: **320** s  
- Máx/hora por instância: **40**  
- Máx/dia por instância: **130** (inalterado)

## Ações executadas

1. Atualizado `DISPAROS_DEFAULTS` em `src/index.ts` e fallback em `scheduleNextCampaignDispatchDelay` para usar esses defaults em vez de literais `90`/`240`.
2. Alinhados fallbacks e reset de formulário em `index.html` (`getDisparosFormValues`, `setDisparosFormValues`, `resetDisparosPanelToOriginalAfterCampaignCreate`).
3. Seed JSON em `doc/SQL-2026-03-21__create-disparos-tables.sql` atualizado para installs que rodam esse script (nota: `ON CONFLICT` substitui `custom_config` — revisar em ambientes com config já personalizada).
4. `npm run build` (atualiza `dist/`).

## Arquivos alterados

- `src/index.ts`
- `index.html`
- `doc/SQL-2026-03-21__create-disparos-tables.sql`
- `dist/index.html`, `dist/index.js` (gerados)

## Como validar

- Subir o app e abrir o painel Disparador: campos de delay e máx/hora devem refletir os novos padrões quando não há config persistida.
- `GET /disparos/config` (ou fluxo que carrega config) deve retornar parse com os mesmos defaults quando o backend usa objeto vazio / primeira carga.

## Segurança

Nenhum segredo alterado.

## Palavras-chave (busca futura)

`DISPAROS_DEFAULTS`, `dis-delay-min`, `dis-max-hour`, disparador-temporizador, limite-hora-dia

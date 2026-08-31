# LOG — Migração automática de config legada do disparador

## Contexto (resumo)

Mesmo após atualizar os defaults para 120/320/40/130, a tela continuava exibindo 90/240 porque o frontend carregava `custom_config` legada já persistida no Supabase.

## Ações executadas

1. Criada a função `isLegacyDisparosDefaultConfig` em `src/index.ts` para detectar a assinatura legada (`90/240/60/130`).
2. Ajustada `loadDisparosConfigFromDb` para:
   - identificar esse perfil legado,
   - migrar para os defaults atuais (`120/320/40/130`),
   - persistir automaticamente com `saveDisparosConfigToDb`.
3. Executado `npm run build`.
4. Reiniciados os ambientes locais (`3000` e `3010`).
5. Validação via `GET /disparos/config` em `3000`: retornou `delayMin=120`, `delayMax=320`, `maxHour=40`, `maxDay=130`.

## Arquivos alterados

- `src/index.ts`
- `dist/index.js` (gerado pelo build)

## Como validar

- Abrir o painel Disparador e confirmar:
  - Delay mínimo: 120
  - Delay máximo: 320
  - Máx/hora por instância: 40
  - Máx/dia por instância: 130
- Verificar `GET /disparos/config`.

## Segurança

- Nenhum segredo exposto.
- Migração restrita ao perfil legado exato de defaults antigos.

## Palavras-chave

`disparos_config`, `custom_config`, `isLegacyDisparosDefaultConfig`, `loadDisparosConfigFromDb`, `migracao-defaults`

# LOG — «+ Instâncias» não trocava o chip vermelho

## Contexto do pedido

Campanha Corbans pausada: `WB-2477` vermelho. Clique em «+ Instâncias» não puxava o próximo número ativo (ex.: `wb-9224`). A UI dizia que não havia instância livre.

## Comandos / ações

Leitura do GET/POST `/disparos/campanhas/:id/instancias` e da identidade de spare. Sem `sendText` de probe.

## Solução implementada

1. **Causa:** `nameKeys` da tag EVO incluía `profileName` do WhatsApp. `walkup-5401` e `wb-9224` compartilham o perfil `Walkup`; o spare era tratado como já selecionado. O POST auto devolvia 409 e a lista não mudava.
2. Identidade da campanha/spare: só chave EVO, alias técnico (`WB-5401`) e telefone ≥8 dígitos. Perfil WhatsApp fora.
3. Selfcheck: `WB-5401` não absorve `WB-9224`; dois chips com displayName `Walkup` não se misturam.

## Arquivos criados/alterados

- `src/instances/campaign-instance-identity.ts`
- `src/index.ts`
- `src/deploy-marker.ts` → `DEPLOY-2026-08-31-150500-mais-instancias-spare-identity`
- `dist/` correspondente
- `.cursor/project-memory/05-DECISIONS.md`, `06-CURRENT_STATUS.md`, `08-DEPLOY.md`, `INDEX.md`
- `doc/memoria.md`

## Como validar

1. `node dist/instances/campaign-instance-identity.selfcheck.js` → `campaign-instance-identity ok`
2. Após Redeploy (EasyPanel, pelo operador): `GET /health` com marker `DEPLOY-2026-08-31-150500-mais-instancias-spare-identity`
3. Funcional: Corbans com um chip vermelho e `wb-9224` (ou outro) conectado fora da seleção — «+ Instâncias» troca 1:1. Sem `sendText` de teste.

## Observações de segurança

Sem log de senha. Sem probe WhatsApp.

## Palavras-chave

+ Instâncias, spare, profileName, Walkup, WB-5401, wb-9224, Corbans, identidade campanha

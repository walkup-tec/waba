# LOG - TTL do lock automático no backend

## Contexto do pedido

Usuário solicitou remover o controle de TTL do lock da interface e aplicar regra segura direto no backend.

## Implementação

- Removido campo de UI `TTL do lock` da aba `Disparos`.
- Ajustado parser de configuração no backend para **ignorar TTL enviado pelo cliente**.
- Regra de cálculo automático aplicada:
  - `ttlBase = delayMaxSeconds * 3`
  - `lockTtlSeconds = clamp(ttlBase, 180, 1800)`
  - onde `clamp` limita entre 3 e 30 minutos.
- Mantida transparência na UI com nota: “TTL calculado automaticamente no backend”.

## Arquivos alterados

- `src/index.ts`
- `index.html`
- `dist/index.html`
- `dist/index.js`

## Validação

- Build executado com sucesso (`npm run build`).
- Sem erros de lint nos arquivos alterados.

## Observações de segurança

- Reduz risco operacional de TTL incorreto configurado por usuário.
- Evita lock curto demais (concorrência duplicada) ou longo demais (bloqueio indevido).

## Palavras-chave

- lock-ttl
- backend-policy
- disparos-config-seguranca

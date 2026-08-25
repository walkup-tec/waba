# Build PASS + exchange-code legado MASTER only

Data: 2026-08-25 17:15 (America/Sao_Paulo)

## Contexto do pedido

Corrigir somente o que impede `npm run build`, fechar o risco residual de token no Embedded Signup legado, regressão Meta, pacote de commit seletivo. Sem commit, push ou deploy.

## Comandos / ações

- Restauro do módulo `src/instances/whatsapp-connecting-restriction.service.ts` a partir do histórico Git (`c00f377`).
- Ajuste de chamadas `registerAquecedorInstancePreparing` (3º argumento inválido) e tipagem de timers no shutdown em `src/index.ts`.
- Encerramento do processo local `node dist/index.js` (PID 21064) que travava escrita em `dist/`.
- Guard `authorizeMetaOficialTokenMint` no handler único de exchange-code (todos os aliases).
- Teste extra no suite `test:meta-lab-tokens`.
- `npm run build` (duas vezes, ambas exit 0).
- Suites Meta 2, 3, 5–9 e lab-tokens.

## Solução — build

| Erro | Classe | Correção |
|------|--------|----------|
| import `./instances/whatsapp-connecting-restriction.service` ausente | A — fonte omitida, módulo real no histórico | Restaurado do Git; não foi inventado vazio |
| 3 argumentos em `registerAquecedorInstancePreparing` | C — assinatura é `(name, preparingSince?)` | Removido 3º argumento; `forceNewIntegration` pertence a outra função |
| `any` implícito no shutdown | D | `cleared: string[]`, `err: unknown` |
| lock/UNKNOWN em `dist/` | E | Processo Node local prendia os JS gerados; processo encerrado. `dist/` é artefato regenerável |

Não houve refactor de Evolution/Aquecedor/Campanhas/Billing. A assinatura do lifecycle do aquecedor não mudou; só as chamadas inválidas.

## Solução — exchange-code legado

Handler `metaEmbeddedSignupExchangeCodeHandler` agora chama o mesmo guard das rotas `/meta-oficial/tokens/*`.

Aliases (um único handler):

- `POST /waba-embedded-signup-exchange`
- `POST /meta/embedded-signup/exchange-code`
- `POST /meta-oficial/embedded-signup/exchange-code`
- `POST /api/meta/embedded-signup/exchange-code`

Fluxo novo `/integrations/meta/whatsapp/*` inalterado: `stripMetaSecrets`, sem `accessToken` no DTO.

## Como validar

```text
npm run build
npm run test:meta-lab-tokens
npm run test:meta-phase2
npm run test:meta-phase3
npm run test:meta-phase5
npm run test:meta-phase6
npm run test:meta-phase7
npm run test:meta-phase8
npm run test:meta-phase9
```

`test:meta-phase4` não existe.

## Segurança

- Segredos reais não usados nos testes.
- Processo local `node dist/index.js` foi parado para o tsc gravar; o servidor local precisa ser reiniciado se ainda for usado nesta máquina.
- Risco residual: rotas legado `/meta-oficial/embedded-signup/subscribe-webhooks` e `/meta-oficial/ativos/*` aceitam `token` no body (não mintam token; qualquer sessão autenticada pode proxy Graph com token colado). Fora do escopo desta etapa.

## Evitar duplicação (palavras-chave)

build tsc, dist lock, whatsapp-connecting-restriction, registerAquecedorInstancePreparing, exchange-code master-only, authorizeMetaOficialTokenMint

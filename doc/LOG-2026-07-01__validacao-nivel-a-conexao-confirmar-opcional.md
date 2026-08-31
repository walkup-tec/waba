# Validação 2 níveis — conexão (A) + CONFIRMAR opcional (B)

**Marker:** `DEPLOY-2026-07-01-validacao-nivel-a-conexao-opcional-confirmar`

## Mudança de processo

| Nível | Critério | Bloqueio |
|-------|----------|----------|
| **A** | QR + `connectionState=open` | Não — conclui integração |
| **B** | CONFIRMAR + resposta automática | Opcional — botão explícito |

## UX passo 3

Após QR conectado:

1. Tela **«Conexão confirmada»** com **Concluir integração** (padrão).
2. Link **«Validar envio CONFIRMAR (opcional)»** inicia nível B.
3. Removido diálogo «Pular validação?» — concluir é fluxo normal.

## Backend (já existente)

- Pull-only na recepção (sem webhook).
- Instância nova inbox vazio (`7943`) → libera após Sim + conexão open.
- Textos progressivos na busca CONFIRMAR.

## Arquivos

- `index.html`, `dist/index.html`
- `src/instance-inbound-validation.service.ts`
- `src/deploy-marker.ts`

## Validar

1. QR → passo 3 → **Concluir integração** → passo 4 imediato.
2. Opcional: **Validar CONFIRMAR** → fluxo Sim/busca.
3. `7943` opcional ou empty-inbox após Sim.

## Palavras-chave

`validacao-nivel-a`, `conexao-opcional`, `5182007943`, `wizard-passo-3`

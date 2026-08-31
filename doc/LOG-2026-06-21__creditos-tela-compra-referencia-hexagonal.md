# LOG — Tela de compra alinhada à referência hexagonal

## Contexto

Pedido para a aba **Créditos → Contratar** ficar como o mock de referência (hexágonos à esquerda, listas em cápsulas à direita, rodapé de benefícios), mantendo os botões **Contratar** com o fluxo atual (`openDisparosPricingModal`).

## Solução

- **Cluster hexagonal:** badges flutuantes (WhatsApp verde / foguete azul), hex «Pacotes e serviços» central, «API Oficial» e «API Alternativa» com glow.
- **Lanes:** listas de features em cápsulas com check (7 itens Oficial, 6 Alternativa) conforme referência.
- **Ação de compra:** preço, mínimo R$ 300 e botão `data-disparos-contratar` por API (funções JS inalteradas).
- **Rodapé:** barra Seguro / Performance / Flexível.

## Arquivos

- `index.html` — HTML + CSS da tela de compra
- `dist/index.html` — sincronizado via `npm run build`

## Validar

1. Créditos → Contratar: layout hex + cápsulas + rodapé.
2. Botão **Contratar** (Oficial/Alternativa) abre modal de tabela de preços e PIX.
3. Modal «Adicionar créditos» (repurchase) herda o mesmo layout clonado.

## Palavras-chave

`disparos-pricing-board`, `disparos-pricing-benefits`, `disparos-api-feature-list`, `data-disparos-contratar`

# LOG — Contratar: tabela preços + fluxo PIX

**Data:** 2026-06-10

## Fluxo
1. **Contratar** → modal tabela (checkbox por linha, seleção única)
2. Total a pagar atualizado ao marcar
3. **Continuar** → modal dados (nome, e-mail, CPF, WhatsApp)
4. **Gerar PIX** → banner “Gerando…” → QR + banner “Aguardando confirmação…”
5. Asaas confirma → **Pagamento confirmado** + botão **Fechar**

## Arquivos
- `index.html` — UI tabela, estados PIX, tiers oficial/alternativa
- `waba-billing.service.ts` — `shipmentCount` no pedido e descrição Asaas

## Teste
`http://localhost:3012/version-02/` → Disparos → Contratar

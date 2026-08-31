# Device Cloud — status na lingueta + fluxo guiado

## Contexto

Travou com digitação no Google e status «Código aceito…» no rodapé. Pedido: status na lingueta; testar passo a passo.

## Solução (Passo 1)

- Status vai para subtexto da lingueta (não no rodapé).
- Painel inferior só com Cancelar / Inserir código (sem texto de progresso).
- Navegação/digitação automática pausada: gera `pairingCode`, usuário abre a tela no WhatsApp e clica «Inserir código no device».

## Marker

`DEPLOY-2026-08-20-device-cloud-lingueta-status-guiado`

## Validar

1. Redeploy `waba_disparador` + Ctrl+F5
2. Lingueta → gera código → subtexto na lingueta
3. Abrir Aparelhos conectados → Vincular com número → Inserir código
4. Lingueta mostra «Código aceito…» / «Integração Finalizada»

## Keywords

device-cloud, lingueta-sub, pairing-guiado, sem-rodape-status

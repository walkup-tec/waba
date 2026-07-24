# LOG — Saúde da rede exclusiva Mozart

## Pedido
Painel «Saúde da rede» (matriz/KPIs do aquecedor) só para `mozart.pmo@gmail.com`. Proibido exibir a qualquer outro usuário.

## Feito
- UI: `#aquecedor-network-health` inicia `hidden`; só remove hidden se a sessão for Mozart
- JS: `loadAquecedorNetworkHealth` aborta e limpa DOM se e-mail ≠ Mozart
- API: `GET /aquecedor/network-health` retorna **403** se e-mail ≠ `mozart.pmo@gmail.com`

## Validar
1. Login Mozart → Aquecedor → vê Saúde da rede
2. Login outro usuário → bloco ausente; curl/API com sessão alheia → 403

## Keywords
Saúde da rede, network-health, mozart.pmo@gmail.com, ACL

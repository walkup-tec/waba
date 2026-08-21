# LOG — Digitar já avança no WhatsApp (Avançar / Continuar)

## Contexto

Número `51 98200-6034` entrou certo. Depois: banner Google Play Services e a tela ficou parada no **Avançar**. Pedido: sem clique humano em Avançar.

## Causa do “voltar à mesma tela”

O heads-up **Erro do Google Play Services** (“Tap to finish setup…”) intercepta o toque. Não é falha do número. O modal “número já confirmado” pede **Continuar**.

## Solução

Após Digitar: esconde teclado (Back) → afasta o banner (swipe) → toca **Avançar** (teclado aberto e fechado) → toca **Continuar** se o diálogo aparecer.

Marker `DEPLOY-2026-08-17-device-cloud-avancar`.

## Palavras-chave

`Avançar`, `Continuar`, `Google Play Services`, `Device Cloud`, `Digitar`

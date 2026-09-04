# Bugs conhecidos

O Disparo Cloud da Jandira 2 (`26d33b09-…` e retrabalho `c8e99348-…`) foi cancelado (void). Sem arquivo local no servidor, o disparo de template com mídia no topo **não inicia**: o operacional envia de novo a mesma foto na tela do Disparo Cloud. A Meta não reusa o link de exemplo, mesmo se a imagem for igual em outro template aprovado.

O Disparo Cloud antigo da Jandira 2 (`26d33b09-…`) e o retrabalho `c8e99348-…` são cancelados no boot (void) se ainda estiverem ativos. O assinante continua em **Em andamento** até existir um disparo novo com entrega.

Redeploy EasyPanel do disparador pode deixar login em 502 até o heal republicar `:30180`. Isso não é senha inválida.

A partir do marker `DEPLOY-2026-09-03-193200-broadcast-resume-orphan`, Redeploy retoma Disparo Cloud `running`/`queued` com leads pendentes (não precisa void manual só por restart).

Resolvido no marker `DEPLOY-2026-09-03-215100-quantum-portfolio-numbers`: portfólio Quantum (e outros BM com várias conexões) listava só 1 número porque o absorb do dedupe descartava chips da 2ª conexão e `phone_numbers` não paginava.

Resolvido no marker `DEPLOY-2026-09-04-102500-quantum-bm-waba-fanout` (parcial): fan-out só por edges `owned_*`/`client_*` do BM — insuficiente com token ES (403/vazio).

Resolvido no marker `DEPLOY-2026-09-04-110500-quantum-fanout-debug-token`: hydrate descobre WABAs via `debug_token.granular_scopes.target_ids` (+ nested BM / `me/businesses`) antes de paginar `phone_numbers`. Se o ES só compartilhou 1 WABA com o app, a UI continua com 1 chip até novo **+** Embedded Signup nas demais.

Resolvido no marker `DEPLOY-2026-09-04-114500-profile-photo-independent-name`: editar foto falhava com erro genérico quando a Meta recusava o nome (`new_display_name`) — o fluxo abortava antes do `profile_picture_handle`. Nome e foto agora são independentes.
- Upload header-media com mensagem genérica de tamanho: corrigido em 2026-09-04 (código Graph + não culpar <5MB).
- Header-media “código 4” + pedir reconectar: era rate limit da Meta; corrigido em 2026-09-04 (mensagem de cota, sem retry, sanitizer).
- Header-media JSON “Se for por tamanho” com Graph #4: wrap descartava “A Meta limitou…” — corrigido em 2026-09-04.

# LOG — Push "Failed to fetch" (timeout)

## Sintoma

Botão **Enviar push** → `Failed to fetch` (vermelho), embora o histórico mostre envio parcial/concluído.

## Causa

Push com **Comunidade + E-mail + imagem** demora >60s (SMTP sequencial + Evolution). O browser/proxy corta a conexão antes da resposta JSON.

## Correções

- E-mail em **paralelo** (`Promise.all`).
- Comunidade + e-mail em **paralelo** no backend.
- **Fast path** comunidade: JID já em `waba-push-config.json` → não chama `fetchAllGroups`.
- Probe Evolution limitado (3 instâncias, 15s).
- Frontend: timeout **180s** com comunidade/e-mail; mensagem amigável; recarrega histórico no erro.

**Marker:** `DEPLOY-2026-06-30-push-send-timeout-fix`

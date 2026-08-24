# LOG — 2026-08-24 — Campanha Alternativa: CTA variável + opt-out itálico

## Contexto do pedido

A cada envio Alternativa, na mesma chamada do GPT:

1. Variar o rótulo do botão URL a partir do CTA que o usuário já cadastra (máx. ~20 caracteres). Destino do botão permanece o link cadastrado.
2. Acrescentar no final do texto uma variação de “😊 Se não quiser mais receber minhas mensagens, é só me avisar, tá bem?”, em itálico WhatsApp (`_texto_`). Sem segundo botão.

## Ações executadas

- `buildDisparosAiPrompt` (modo botão) passou a pedir JSON `{ body, buttonLabel, optOut }`.
- `composeOutboundMessageForConfig` e `POST /disparos/gerar-mensagem-ai` montam corpo + opt-out itálico e usam o rótulo gerado.
- `npx tsc` sem erro.

## Solução implementada

- CTA base do usuário é a semente; o GPT parafraseia (não copia literal).
- Opt-out: variação da frase-semente; o backend envolve em `_..._`.
- Fallback: se o JSON falhar, usa o texto bruto + frase-semente + CTA original.
- Sem segundo botão nativo (limitação Evolution/WhatsApp `cta_url`).
- Rótulo do botão limitado a **15 caracteres** (`ALTERNATIVA_BUTTON_LABEL_MAX_CHARS`).

## Arquivos criados/alterados

- `src/index.ts`
- `dist/index.js` (gerado)

## Como validar

- Prévia em Disparos → API Alternativa → gerar mensagem: corpo + linha itálico + botão com texto diferente do cadastrado, URL igual.
- Campanha em execução: cada lead com rótulo e opt-out distintos.

## Observações de segurança

Sem credenciais. Sem URL no corpo. Sem segundo botão.

## Palavras-chave

`composeOutboundMessageForConfig`, `buttonLabel`, opt-out itálico, CTA parafraseado, sendButtons

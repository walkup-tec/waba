# Estudo Evolution + WhatsApp: botão nativo na Alternativa

## Contexto do pedido

Validar atualizações da Evolution e do WhatsApp antes de alterar o WABA, para garantir botão nativo (não URL no texto).

## Comandos / ações

- Leitura da doc oficial Evolution sendButtons e releases 2.3.7 / 2.4.0-rc.
- Leitura da doc oficial Meta Cloud API CTA URL (atualizada 2026-07-02).
- Issues/PRs: #2390, #2404, #2467, PR #2651.
- Revertido o patch local `isGhostButtonsPayload` (não publicar: trata viewOnce como sucesso e some o texto).

## Conclusão (não alterar o WABA para “forçar” o botão)

O envelope `viewOnceMessage` é montado **dentro da Evolution 2.3.7 (Baileys)**, não no payload do WABA. Mudar o detector no `src/index.ts` não faz o WhatsApp desenhar o botão.

| Fonte | O que diz |
|---|---|
| Evolution 2.3.7 em produção | `POST /message/sendButtons` aceita o payload; envolve CTA em `viewOnceMessage`. |
| Evidência WABA 20/08 | Tratar esse viewOnce como sucesso = só imagem; o viewOnce não aparece no chat. |
| PR #2651 (aberto) | `viewOnceMessage` não suporta botões interativos; o fix é `interactiveMessage` + `relayMessage` + nós `native_flow`. |
| Evolution **2.4.0-rc** (06/05/2026, pré-release) | Remove o wrapper viewOnce e injeta `<native_flow v=9 name=mixed/>`. **Não está em `main`**. Exige licença (503 `LICENSE_REQUIRED`) e migration `RuntimeConfig`. |
| WhatsApp Cloud API (oficial) | Botão CTA URL nativo: `type: interactive`, `interactive.type: cta_url`. Isso **não** é a sessão Baileys da Alternativa. |

Docs oficiais usadas:

- https://docs.evolutionfoundation.com.br/evolution-api/send-buttons
- https://github.com/evolution-foundation/evolution-api/releases (2.4.0-rc1/rc2)
- https://github.com/evolution-foundation/evolution-api/pull/2651
- https://developers.facebook.com/docs/whatsapp/cloud-api/messages/interactive-cta-url-messages/

## O que o WABA já envia (correto para o contrato EVO)

`title` + `description` + `footer: ""` + `buttons: [{ type: "url", displayText, url }]`. Trocar esse JSON **não** unwrap o viewOnce.

## Caminhos reais (fora do WABA, precisam autorização)

1. **Upgrade da Evolution** para 2.4.0-rc (ou build com o patch #2651) no serviço `walkup-evo` — breaking: licença + Prisma. Só depois um envio real no celular valida o botão.
2. **API oficial Meta** (`cta_url`) — outro canal, não os chips Baileys da Alternativa.

## Como validar (quando a Evolution for a versão certa)

1. Confirmar versão EVO ≠ 2.3.7 com o wrapper viewOnce.
2. Um envio Alternativa: imagem + texto sem URL + botão **Quero saber mais** no aparelho.
3. Sem rajada `sendText`. Sem tratar HTTP 201 como prova.

## Observações de segurança

Sem probe de envio. Sem log de chaves. Evolution não foi alterada (outro serviço).

## Palavras-chave

sendButtons, viewOnceMessage, Evolution 2.3.7, Evolution 2.4.0-rc, PR 2651, native_flow, WhatsApp Cloud API cta_url, API Alternativa

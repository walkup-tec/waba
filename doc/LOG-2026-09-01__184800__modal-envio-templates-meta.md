# Modal de envio dos templates à Meta

## Contexto do pedido

O cadastro das três opções Utility usava `window.confirm` nativo («waba.draxsistemas.com.br diz») e, em falha, só um texto solto na página. Pedido: modal no estilo do sistema, estado de processamento com logo da Meta, erro no modal e sucesso com prazo de análise da Meta. Também explicar a tentativa que falhou.

## O que aconteceu na tentativa (DG01 + Imagem + PNG)

A mensagem exibida foi exatamente `template_invalid`:

«Os dados do template não são válidos. Confira nome, idioma, categoria, corpo e exemplos das variáveis.»

Isso é validação **local** (ou upload remapeado), não a recusa Graph «A Meta recusou o template…». A Meta ainda não chegou a analisar os três templates.

Hipótese principal (confiança alta), combinável:

1. **Mídia Imagem sem `header_handle`** — a Meta exige upload resumable do JPEG/PNG. Se o handle não chegou (upload falhou, MIME do PNG do ChatGPT veio como `octet-stream`/`image/x-png`, ou o Graph não devolveu `h`), o backend rejeitava com a mensagem genérica.
2. **URL do botão sem `https://`** — `wa.me` sem esquema, `http://` ou `whatsapp://` também caíam no mesmo `template_invalid`.
3. O diálogo nativo era o `confirm` antigo; o texto de erro ia para `#meta-tpl-ai-submit-status`, sem modal.

O campo Cabeçalho «Texto do HEADER» com mídia Imagem **não** é enviado (a Meta aceita um HEADER: texto **ou** mídia). Isso sozinho não gera esse erro.

## Solução

- Overlay `#meta-tpl-ai-overlay` no padrão `.confirm-overlay` / `.confirm-modal`.
- Fases: confirmar → processando (logo Meta + spinner) → sucesso ou erro no mesmo modal.
- Sucesso: templates encaminhados; Meta pode levar até 24 h; usar Atualizar da Meta.
- Erros específicos: `template_url_https`, `template_media_required`, `template_upload_failed`.
- Upload de imagem aceita PNG/JPEG com MIME genérico ou `image/x-png` pela extensão do arquivo.

## Arquivos

- `index.html`
- `src/integrations/meta-whatsapp/meta-whatsapp-errors.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-template-ai-shell.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-template-ai.service.ts`
- `src/integrations/meta-whatsapp/meta-whatsapp-template-ai.test.ts`
- `src/deploy-marker.ts`

## Como validar

```bash
npm run test:meta-template-ai
npm run build
```

Preview local: `/?ui-preview=template-ai` → Enviar para META abre o modal do sistema (não o alerta do navegador).

Produção: Redeploy `waba_disparador` e `GET /health` → `DEPLOY-2026-09-01-184800-modal-envio-meta`.

## Segurança

Sem tokens ou segredos no modal. Logo: `/media/meta-logo.png` com SVG de fallback.

## Palavras-chave

modal, confirm, alert, template_invalid, header_handle, upload, https, 24 horas, Meta

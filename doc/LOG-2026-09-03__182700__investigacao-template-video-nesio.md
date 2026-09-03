# LOG — Investigação: falha ao subir template com vídeo (Nésio)

## Sintoma

Usuário tenta cadastrar template Utility com mídia **Vídeo** (`Apresentacao_Nesio.mp4`), modelo «Nésio Fernandes», botão «Saiba Mais» e URL `https://wa.me/5527996632879?...`. Na tela: «Opção 3 salva».

## Evidência do VPS (usuário)

Container: `waba_waba_disparador.1.ba4xrubgifa1yb817yiuvigi0`

`docker logs --since 60m` filtrado **não** mostrou `headerUpload`, `template_upload`, `[META][TEMPLATE]` nem `Nesio`. Só `LEADS_SCRAPE` e `[campanhas] upload planilha`.

Conclusão: o pedido de upload/envio do vídeo **não chegou** ao Node (ou falhou só no browser), ou o clique foi só «Salvar» da opção 3.

Produção `/health` ainda no marker `DEPLOY-2026-09-03-171800-oficial-dedupe-ai-edit`.

## Hipóteses (sem log)

1. **Alta — falha no Enviar para META no upload resumable do vídeo** (`POST .../templates/ai/header-media`): timeout 60s, MIME, ou recusa Graph → `template_upload_failed`.
2. **Média — URL wa.me** no botão: destino pode ser encurtado antes da Graph; se o encurtador falhar ou a validação local recusar, aparece `template_url_restricted` / `template_shorten_failed`.
3. **Baixa — só salvou a opção 3** (editar texto) e ainda não concluiu o Enviar; o texto de ajuda da UI fala só JPEG/PNG (cosmético).

## Próximo passo

1. Pedir o texto do modal de erro **ou** liberar SSH para `docker logs`.
2. Com o erro exato, corrigir (timeout vídeo / mensagem / accept de arquivo / aviso de URL).

## Palavras-chave

nésio, vídeo, mp4, header-media, template_upload_failed, wa.me, logs VPS

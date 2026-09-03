# LOG — Modal genérico ao enviar template com vídeo

## Sintoma

03/09/2026 ~18:59 UTC. Modal Meta: «Não foi possível enviar» / «Não foi possível concluir a conexão. Tente novamente.»

Produção já no marker `DEPLOY-2026-09-03-182400-header-id-template-aprovado`.

## Mapeamento no código

Essa frase é o fallback `toPublicMetaError` com `code: "unknown"` (`meta-whatsapp-errors.ts`). Não é `template_upload_failed` nem `template_url_restricted`.

No fluxo **Enviar para META**, o upload do vídeo (`POST .../templates/ai/header-media`) ou o `submit-all` devolveu um erro não tipado (ou a resposta passou pelo handler genérico).

## Hipóteses

1. **Alta** — upload resumable do MP4 estourou timeout (60s) / proxy / memória e a falha não chegou como `MetaWhatsappError` com mensagem clara.
2. **Média** — Meta recusou o arquivo, mas a mensagem real não subiu ao modal.
3. **Baixa** — falha no encurtador da URL do botão (`wa.me`).

## Evidência ainda faltando

Colar saída VPS logo após o erro:

```bash
CONTAINER="$(docker ps --format '{{.Names}}' | grep -E 'waba.*disparador' | grep -vE 'v01|v02' | head -1)"
docker logs --since 10m "$CONTAINER" 2>&1 | grep -F '[META][TEMPLATE]' | tail -80
```

## Palavras-chave

vídeo, mp4, concluir a conexão, unknown, header-media, timeout 60s

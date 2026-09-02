# LOG — PNG de cabeçalho recusado no envio à Meta

## Contexto

O modal mostrou «use JPEG ou PNG» com um arquivo PNG. A mensagem era genérica: qualquer falha do upload resumable caía nela.

Doc oficial: https://developers.facebook.com/docs/graph-api/guides/upload
- `file_type` `image/jpeg` ou `image/png`
- `file_name` simples
- imagem de template: no máximo 5 MB

## Correção

- Detectar PNG/JPEG pelos bytes (não só pelo MIME do navegador).
- Enviar `header.png` / `header.jpg` para a Graph (nomes tipo «ChatGPT Image…» quebravam a sessão).
- Recusar imagem > 5 MB com mensagem própria.
- Logar status Graph no upload sem token.

## Como validar

```bash
npm run test:meta-template-ai
```

Após Redeploy: PNG ≤ 5 MB deve subir. PNG maior mostra o limite de 5 MB.

Marker: `DEPLOY-2026-09-02-115100-png-header-upload`

## Palavras-chave

PNG, header, resumable upload, 5 MB, ChatGPT Image, file_name, MIME

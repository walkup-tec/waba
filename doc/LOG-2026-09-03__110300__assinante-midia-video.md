# LOG — Assinante sobe imagem ou vídeo na campanha

## Contexto

Na etapa de configuração do assinante havia só upload de imagem. Passar a permitir vídeo, com a regra de formato visível antes do arquivo.

## Solução

- Etapa 3 do wizard virou **Mídia**: o assinante escolhe Imagem ou Vídeo.
- Imagem: PNG/JPG 1080×1080 (igual ao que já existia).
- Vídeo: somente MP4 (H.264, áudio AAC ou sem áudio, até 16 MB). MOV/WebM/AVI/MKV/GIF são recusados.
- O servidor confere os bytes (`ftyp` + marca MP4) e o tamanho. 3GP e QuickTime (`qt`) são recusados.
- Operacional baixa “imagem” ou “vídeo” conforme o arquivo.

Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media/

## Como validar

```bash
npm run test:campaign-intake-media
```

No wizard do assinante: escolher Vídeo, ver as regras, tentar um MOV (deve recusar) e um MP4 (deve aceitar).

## Palavras-chave

`mediaKind`, `MP4`, `wizard`, `assinante`, `1080`, `16 MB`

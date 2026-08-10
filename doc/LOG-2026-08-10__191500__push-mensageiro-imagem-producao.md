# LOG — Push produção: Mensageiro Imagem 1080 + remoção planilha

## Contexto

Usuário pediu push de tudo que ainda não estava disponível para Deploy em produção (teste local de randomização adiado).

## Já estava em `origin/master`

- Resumo Enviados (`27faa72`)
- Dashboard por API Oficial/Alternativa
- Campanha oficial WhatsApp nome/logo + leads Excel/TXT + mín. 1000

## Incluído neste push

1. Abas Mensagem/Imagem no Mensageiro (4×1080 obrigatórias)
2. Round-robin de imagens; envio imagem → ACK → texto
3. Remoção da base de mensagens por planilha (`/disparos/templates*` → 410)

## Não incluído (só V02 local)

- Telefones `sim-campanha-*`
- Grant de 100k créditos locais
- Dados em `data/v02/`

## Marker

`DEPLOY-2026-08-10-mensageiro-imagem-1080`

## Como validar após Deploy

1. GitHub Actions → Deploy FTP (bundle)
2. Redeploy Node no host se necessário
3. `/health` com marker acima
4. Mensageiro: aba Imagem exige 4 arquivos 1080×1080
5. Campanha Alternativa: imagens variando por destino

## Palavras-chave

`mensageiro-imagem`, `1080`, `push-master`, `deploy-ftp`, `remove-planilha`

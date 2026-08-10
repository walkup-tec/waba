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

## Correção 2026-08-10 20:15 — dist faltando

Sintoma: produção ≠ V02 (ainda com «Usar base de mensagens»; `/health` = `DEPLOY-2026-08-07-campaign-ack-check`).

Causa: push `ada713a` só tinha `src/` + `index.html` raiz. Docker EasyPanel usa `COPY dist` e **não** compila TypeScript.

Ação: `npm run build` + commit/push de `dist/` (marker + HTML + sendMedia).

**Obrigatório após este push:** Redeploy EasyPanel `waba_disparador` até `/health` mostrar `DEPLOY-2026-08-10-mensageiro-imagem-1080`.

## Como validar após Deploy

1. GitHub Actions → Deploy FTP (bundle)
2. **Redeploy EasyPanel** do serviço Node (obrigatório)
3. `/health` com marker `DEPLOY-2026-08-10-mensageiro-imagem-1080`
4. Mensageiro: aba Imagem exige 4 arquivos 1080×1080 (sem planilha)
5. Hard refresh (Ctrl+F5)

## Palavras-chave

`mensageiro-imagem`, `1080`, `push-master`, `deploy-ftp`, `remove-planilha`

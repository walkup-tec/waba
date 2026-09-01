# Push GitHub master para o EasyPanel receber o assistente Utility

## Contexto

O deploy não subia no EasyPanel. Produção ainda respondia
`DEPLOY-2026-09-01-145500-meta-template-ai-duas-colunas`.

Causa: os commits novos estavam só no remoto Cursor
(`origin.cursor.com`). EasyPanel e o workflow Deploy FTP observam
`github.com/walkup-tec/waba` `master`.

## Ações

- `git fetch github master` — master GitHub estava em `9f46df6`.
- `scripts/git-push-github-master.sh HEAD` — fast-forward
  `9f46df6..ddffa22`.
- Tip remoto: `ddffa2299483eae98efc62368aeaee55a41f7520`.

## Como validar

1. GitHub `master` em `ddffa22` — feito.
2. Actions **Deploy FTP (bundle)** no `ddffa22`: o passo FTP concluiu
   (`Sync complete`). O job ficou vermelho só no *Post Node.js*
   (cache npm inexistente) — isso **não** impede o bundle.
3. Produção ainda responde
   `DEPLOY-2026-09-01-145500-meta-template-ai-duas-colunas` até o
   **Redeploy** do container `waba_disparador` (Docker `COPY dist/`;
   FTP sozinho não troca a imagem).
4. Depois do Redeploy:

```bash
curl -sS https://waba.draxsistemas.com.br/health | grep deployMarker
```

Esperado: `DEPLOY-2026-09-01-162200-ia-3-utility-do-texto-base`

Heal de login se houver 502 (~1 min).

## Segurança

Token só via `$GITHUB_TOKEN`. Sem URL com credencial no log.

## Palavras-chave

easypanel, github-master, deploy-ftp, deploy-marker, git-push-github-master

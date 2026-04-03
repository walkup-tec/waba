# Deploy automático Git → FTP (GitHub Actions)

## Segurança

- **Não envie** usuário, senha ou host FTP em chat, e-mail ou commit.
- Use apenas **GitHub → Settings → Secrets and variables → Actions → New repository secret**.

## Requisitos

- Código no **GitHub** (workflow: `.github/workflows/deploy-ftp.yml`).
- Host FTP acessível a partir da internet (o runner da GitHub conecta no seu servidor).

## Secrets obrigatórios

| Secret | Exemplo | Descrição |
|--------|---------|-----------|
| `FTP_HOST` | `ftp.seudominio.com` | Host FTP |
| `FTP_USERNAME` | usuário do painel | |
| `FTP_PASSWORD` | senha | |
| `FTP_REMOTE_DIR` | `/public_html` | Pasta remota do site (varia: `/www`, `/htdocs`, etc.) |

Confira no painel do provedor qual é o diretório raiz do site.

## Quando roda

- **Push** na branch **`master`** (altere o YAML se o padrão do repo for `main`).
- Manual: **Actions** → **Deploy FTP (bundle)** → **Run workflow**.

## O que sobe

O job executa `npm ci` + `npm run bundle:ftp` e envia o conteúdo de **`ftp-bundle/`** (mesmo pacote do `npm run bundle:ftp` local).

## Após publicar

- Crie **`.env`** no servidor (ao lado de `package.json` / `dist/`), com as variáveis reais. O bundle **não** inclui `.env`.
- O plano precisa permitir **Node.js**; FTP só copia arquivos.

## FTPS / porta

Edite o passo **Enviar para FTP** em `.github/workflows/deploy-ftp.yml` e veja as opções em  
https://github.com/SamKirkland/FTP-Deploy-Action

## Outro Git (GitLab, Bitbucket)

Replique a ideia: no CI, `npm ci`, `npm run bundle:ftp`, depois upload da pasta `ftp-bundle/` com `lftp` ou action equivalente.

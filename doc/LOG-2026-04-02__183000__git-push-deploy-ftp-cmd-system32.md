# LOG — Git push deploy FTP (erro System32 / comandos colados)

## Contexto

Falha ao rodar `git add` / `commit` / `push` no **Prompt de Comando** em `C:\Windows\System32`: `fatal: not a git repository`. Na mesma linha, os comandos foram colados sem separador (ex.: `deploy-ftp.ymlgit commit`).

## Ações executadas

1. Explicar causa: pasta errada + concatenação de comandos.
2. No repositório `E:\Waba`: `git add` dos arquivos necessários ao deploy (workflow, script de bundle, `package.json`, `.gitignore`, `.env.example`, docs, `index.html`, `src/index.ts`) — **sem** `shortener-waba.zip` e **sem** `dist/` neste commit.
3. `git commit` + `git push origin master` (sucesso: `0b7dc2a`).

## Solução (para uso futuro no cmd)

```bat
cd /d E:\Waba
git config --global --add safe.directory E:/Waba
git add .github\workflows\deploy-ftp.yml
git commit -m "sua mensagem"
git push origin master
```

Ou uma linha com `&&`:

```bat
cd /d E:\Waba && git add .github\workflows\deploy-ftp.yml && git commit -m "msg" && git push origin master
```

## Arquivos alterados (nesta sessão)

- Push remoto: workflow e artefatos listados no commit `0b7dc2a`.
- `doc/memoria.md` — entrada com palavras-chave Git/cmd.
- Este arquivo `doc/LOG-2026-04-02__183000__git-push-deploy-ftp-cmd-system32.md`.

## Como validar

- GitHub → **Actions** → workflow **Deploy FTP (bundle)** após o push.
- Servidor: `.env` e processo Node conforme `doc/deploy-ftp-github.md`.

## Segurança

- Secrets apenas no GitHub; nada de credenciais no repositório.

## Palavras-chave

`FTP_HOST`, `deploy-ftp.yml`, `E:/Waba`, `safe.directory`, `not a git repository`, comandos colados cmd

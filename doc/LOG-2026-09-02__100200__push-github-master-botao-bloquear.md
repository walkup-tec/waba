# LOG — Push GitHub master (botão Bloquear)

## Contexto

Pedido: ver tudo que precisa subir e fazer o push para `github.com/walkup-tec/waba` `master` (EasyPanel / Deploy FTP).

## O que faltava

`github/master` estava em `7f3b1ae` (âncoras Utility). HEAD local: `d0d398b` + este commit de registro.

Nada pendente no working tree além de `C:\\Users\\Usuario\\npm-cache/` (não sobe).

## O que foi para o GitHub `master`

- Injeção do `QUICK_REPLY` **Bloquear** em todo POST Graph de template.
- Painel / GET público / preview sem esse botão.
- `dist/` com marker `DEPLOY-2026-09-02-100000-botao-bloquear-silencioso`.

## Como validar

Após Redeploy EasyPanel do `waba_disparador`:

```bash
curl -sS https://waba.draxsistemas.com.br/health
```

O `deployMarker` deve ser `DEPLOY-2026-09-02-100000-botao-bloquear-silencioso`.

## Observações

Push Cursor `origin` ≠ deploy. Redeploy do Node é do usuário. Login pode 502 ~1 min até o heal v6.

## Palavras-chave

github, master, push, Bloquear, quick_reply, EasyPanel

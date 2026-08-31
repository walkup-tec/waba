# LOG — META_WEBHOOK_VERIFY_TOKEN (Fase 5)

## Contexto

Gerar token estável de verificação do webhook Cloud API e gravá-lo no EasyPanel (`waba_disparador`), para usar o mesmo valor no Meta Developers.

## Ações

1. Token gerado com `crypto.randomBytes(32).toString('hex')` (64 hex, estável — não regenerar no restart).
2. Tentativa de gravar no VPS `root@72.60.51.127` via SSH: **Permission denied** (sem chave Hostinger nesta máquina).
3. Valor guardado só em arquivo gitignored `env.easypanel-meta-webhook-verify.snippet`.
4. Deploy/redeploy **não** executado.

## Arquivos

- `env.easypanel-meta-webhook-verify.snippet` (gitignored)
- `.gitignore` (entrada do snippet)

## Como validar

No EasyPanel, Environment do `waba_disparador`: chave `META_WEBHOOK_VERIFY_TOKEN` presente, 64 caracteres hex. No Meta Developers, Verify Token idêntico.

## Segurança

O valor do token não está neste LOG nem em ficheiros versionados. Não logar o token na aplicação.

## Palavras-chave

META_WEBHOOK_VERIFY_TOKEN, easypanel, waba_disparador, webhook-verify, meta-developers

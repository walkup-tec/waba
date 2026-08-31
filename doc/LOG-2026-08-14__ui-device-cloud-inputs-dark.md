# UI — inputs Dispositivos no tema escuro

## Contexto

Campos «Nome do dispositivo» e «Número WhatsApp» com fundo branco quebravam o tema dark do WABA.

## Solução

Inputs passam a usar tokens do sistema: `--bg-card-alt`, `--text`, `--border-subtle`, `--accent` no foco. Autofill do Chrome também fica escuro.

## Arquivos

- `index.html`
- `src/deploy-marker.ts` → `DEPLOY-2026-08-14-device-cloud-inputs-dark`

## Palavras-chave

`dispositivos`, `input dark`, `device-cloud`, `tema`

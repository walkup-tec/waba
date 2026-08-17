# LOG — Novo marker para redeploy Device Cloud

## Contexto do pedido

Gerar um novo deploy marker para identificar o próximo Redeploy Easypanel de `waba_disparador` após falhas de download GitHub (HTTP 429 no archive `codeload`).

## Ações

- Atualizado `src/deploy-marker.ts` e `dist/deploy-marker.js`
- Marker: `DEPLOY-2026-08-17-1628-device-cloud-dialpad`
- Push em `origin/master` para o Easypanel puxar o código

## Como validar

Após Deploy (fonte **Git** / clone, não archive GitHub se 429 persistir):

```bash
curl -sS https://waba.draxsistemas.com.br/health
```

Esperado: `"deployMarker":"DEPLOY-2026-08-17-1628-device-cloud-dialpad"`

## Observações

- O Dockerfile copia `dist/`; alterar só `src/` não muda `/health` em produção.
- Não incluir `dist/` de financeiro/leads não relacionados.

## Palavras-chave

`deploy-marker`, `waba_disparador`, `device-cloud`, `easypanel`, `429`

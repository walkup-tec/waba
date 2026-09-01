# Personalizar deploy marker do assistente Utility

## Contexto

Pedido: personalizar o marker deste deploy para identificar no `/health`
se a versão com a IA reescrevendo o texto base em 3 Utility está no ar.

## Ações

- Atualizado `src/deploy-marker.ts` e `dist/deploy-marker.js`.
- Marker novo: `DEPLOY-2026-09-01-162200-ia-3-utility-do-texto-base`.
- Commit e push na branch de trabalho.

## Como validar

```bash
curl -sS https://waba.draxsistemas.com.br/health | grep deployMarker
```

Esperado: `DEPLOY-2026-09-01-162200-ia-3-utility-do-texto-base`

## Segurança

Sem segredos. Marker público no healthcheck.

## Palavras-chave

deploy-marker, health, assistente-ia, utility, texto-base

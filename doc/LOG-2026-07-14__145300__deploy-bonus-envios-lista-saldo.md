# LOG — Deploy prod + V02 — Bônus Envios lista + saldo inteiro

**Data:** 2026-07-14  
**Pedido:** atualizar localhost V02 e deploy produção com marker personalizado.

## Marker
`DEPLOY-2026-07-14-bonus-envios-lista-saldo-inteiro`

## Conteúdo
- Lista Ativos/Inativos de Bônus Envios + desativar
- Disponível não herda dívida de consumo antigo no grant admin

## Validar prod
```bash
curl -sS https://waba.draxsistemas.com.br/health
# deployMarker = DEPLOY-2026-07-14-bonus-envios-lista-saldo-inteiro
```
Redeploy Easypanel `waba_disparador` se marker antigo persistir.

## Validar V02
```bash
curl -sS http://localhost:3012/version-02/health
```

## Keywords
bonus-envios, lista, saldo-inteiro, deploy

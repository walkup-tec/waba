# LOG — Deploy prod — Cupons lista única

**Data:** 2026-07-14  
**Pedido:** subir produção com redeploy/marker personalizado.

## Marker
`DEPLOY-2026-07-14-cupons-lista-unica-filtro`

## Git
- Commit: `cd727cc` — assunto `[9be678e] feat: cupons lista unica Desconto/Envios + marker DEPLOY-2026-07-14-cupons-lista-unica-filtro`
- `origin/master` = `origin/v02` = `cd727cc`

## Conteúdo
- Lista única de cupons com filtro Desconto | Envios + Ativos | Inativos
- Forms Bônus Envios + Cupom de desconto lado a lado (economiza espaço)

## Validar prod
```bash
curl -sS https://waba.draxsistemas.com.br/health
# deployMarker = DEPLOY-2026-07-14-cupons-lista-unica-filtro
```
- Em 14/07 (pós-push) ainda respondia `DEPLOY-2026-07-14-bonus-envios-lista-saldo-inteiro`
- **Fazer Redeploy Easypanel** do serviço `waba_disparador`
- Após redeploy: ~1 min login pode 502 até `waba-login-heal` republicar `:30180`

## Keywords
cupons-lista-unica, deploy, marker, easypanel

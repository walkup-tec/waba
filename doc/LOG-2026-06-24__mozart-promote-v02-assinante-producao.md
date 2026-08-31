# LOG — Mozart V02 → assinante produção

**Pedido:** levar `mozart.pmo@gmail.com` do V02 como assinante em produção.

## Dados migrados (bundle V02)

| Item | Valor |
|------|--------|
| E-mail | mozart.pmo@gmail.com |
| Nome | Mozart |
| Senha | **mesmo hash V02** (login igual ao V02) |
| Créditos oficial | 1000 contratados, 300 consumidos → **700 restantes** |
| Créditos alternativa | 1000 contratados, 500 consumidos → **500 restantes** |
| Instâncias (owners) | 9 (walkup, soma, drax, atendimento-*, etc.) |

Não migra: campanhas locais V02, tickets, ativações compra números.

## Ferramentas

- `POST /admin/subscribers/promote-from-v02` (master)
- `scripts/promote-subscriber-v02-to-production.cjs`

## Aplicar em produção (Easypanel shell, após deploy)

```bash
cd /app
node scripts/promote-subscriber-v02-to-production.cjs mozart.pmo@gmail.com --apply-data-dir /app/data
```

Reiniciar o serviço Node se estiver em cache de arquivos (recomendado: restart container).

## Aplicar remoto (máquina com HTTPS OK)

```bash
# .env.v02 com WABA_ADMIN_EMAIL / WABA_ADMIN_PASSWORD
node scripts/promote-subscriber-v02-to-production.cjs mozart.pmo@gmail.com --remote https://waba.draxsistemas.com.br
```

## Validar

1. Login assinante: mozart.pmo@gmail.com (senha do V02)
2. `GET /billing/disparos/credits` → saldos oficial/alternativa
3. Aba Instâncias → números do bundle
4. Admin → Assinantes → Mozart listado

**Palavras-chave:** promote-from-v02, mozart, assinante produção, instance-owners

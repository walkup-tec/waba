# LOG — Isolar Traefik Soma CRM (`soma-crm.yaml`)

**Data:** 2026-07-20 ~20:20  
**Contexto:** Após split WABA/Sinal Verde, isolar também o Soma CRM (`app.somaconecta.com.br`) em arquivo dinâmico próprio.

## Doc / REGISTRY

- https://doc.traefik.io/traefik/reference/install-configuration/providers/others/file/
- https://doc.traefik.io/traefik/reference/routing-configuration/http/routing/router/
- `doc/traefik-causes/REGISTRY.md` → `SOMA-EASYPANEL-REWRITE`

## Config canônica

| Item | Valor |
|------|--------|
| Arquivo | `/etc/easypanel/traefik/config/soma-crm.yaml` |
| Domínio | `app.somaconecta.com.br` |
| Backend | `http://172.17.0.1:30300/` |
| Publish | `:30300` → container `3000` |
| Serviço Swarm | `soma-promotora_gestao-interno` |
| Health | `/api/health` |
| entryPoints | `http` / `https` |

## Scripts

- `scripts/fix-soma-crm-isolated-yaml-vps.sh`
- `scripts/soma-crm-overlay-guard-vps.sh`
- `scripts/HOSTINGER-PASTE-traefik-split-soma-crm.sh`
- Rule: `.cursor/rules/soma-crm-heal-pos-redeploy.mdc`

## Validar

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://app.somaconecta.com.br/api/health   # 200
curl -sS -o /dev/null -w '%{http_code}\n' https://wabadisparos.com.br/                 # 200
curl -sS -o /dev/null -w '%{http_code}\n' https://acesso-sinalverde.com/               # 307/200
```

## VPS — sucesso (2026-07-20 23:21 UTC)

- 6 chaves Soma stripped do `main.yaml`
- `soma-crm.yaml` com routers + `172.17.0.1:30300`
- Guard timer+watch ativos
- Final: disparos/bet/health 200 | SV 307 | soma 307 | soma_health 200 | main limpo

## Keywords

`soma-crm.yaml`, `app.somaconecta.com.br`, `30300`, `SOMA-EASYPANEL-REWRITE`, `gestao-interno`

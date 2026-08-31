# LOG — 2026-07-08 08:54 — Restore landings v6 (formato Easypanel + docs Traefik)

## Contexto
- `wabadisparos.com.br` e `bet.waba.info` 404/flapping; várias tentativas de script (v1–v5) falharam.
- Pedido: estudar [docs Traefik](https://doc.traefik.io/traefik/) e só então codar de forma definitiva.

## Causas raiz (cruzamento doc × VPS)

| Fato | Fonte |
|------|--------|
| Config dinâmica hot-reload via File Provider (`directory` + `watch`) | [File provider](https://doc.traefik.io/traefik/reference/install-configuration/providers/others/file/) |
| Router = `rule` + `service` + `tls`; `Host()` + `\|\|` válidos | [Router](https://doc.traefik.io/traefik/reference/routing-configuration/http/routing/router/) · [Rules](https://doc.traefik.io/traefik/reference/routing-configuration/http/routing/rules-and-priority/) |
| ACME deriva domínio de `Host()` e/ou `tls.domains` | [ACME](https://doc.traefik.io/traefik/reference/install-configuration/tls/certificate-resolvers/acme/) |
| **Easypanel `main.yaml` não é `http.routers:` YAML** — usa chaves `"https-waba_paginadevendas-0"` + `"rule": "Host(...) && PathPrefix(\`/\`)"` | Inspeção VPS 08/07 |
| `custom.yaml` neste VPS = acessoLog/api (estático) — misturar `http.routers` lá gerou **502** no easypanel host | Tentativa v4 |
| Overlay `tasks.waba_paginadevendas:3000` inalcançável → host gateway `172.17.0.1:30200/30201` | Mesmo padrão WABA 30180 |
| `docker service update --publish` em porta ocupada (30210=v02, 30211) → **task Pending forever** | Tentativas publish |
| Matar docker-proxy com Traefik 1/1 derruba :443 | Bloco B |
| Traefik `0/1` / exit 137 → **tudo** HTTPS 000 (não só landings) | Diagnóstico 11:43 UTC |

## Solução v6 (`restore-landing-routers-vps.sh`)
1. Garante Traefik 1/1 + :443 (bootstrap/force detach) — **abort se falhar**.
2. Remove `WABA_LANDINGS_MERGE` / `http:` dinâmico inválido do `custom.yaml`.
3. Patch **só** `main.yaml`:
   - `Host(easypanel) && PathPrefix(/)` → `(Host(easypanel) || Host(public)) && PathPrefix(/)`
   - `tls.domains.sans` com domínio public (ACME)
   - backend `172.17.0.1:PORT` se porta publicada responde 200
   - se bets_pv ausente: clona blocos http/https/service a partir do paginadevendas
4. Soft reload: `docker kill -s HUP` (sem force).
5. Validação com `--resolve …:127.0.0.1` (hairpin).

## O que NÃO fazer
- Publish de porta “inventada”
- Escrever routers YAML em `custom.yaml` neste VPS
- Kill docker-proxy “zumbi” sem confirmar Traefik 0/1
- Regex com `(` não escapado em `re.sub` (erro v3)

## Validar no VPS
```bash
curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/restore-landing-routers-vps.sh" -o /root/restore-landing-routers-vps.sh
sed -i 's/\r$//' /root/restore-landing-routers-vps.sh && chmod +x /root/restore-landing-routers-vps.sh
/root/restore-landing-routers-vps.sh
tail -40 /var/log/restore-landing-routers.log
```

Esperado no log: `INJETADO wabadisparos…`, `contains wabadisparos.com.br: True`, códigos 200 nos 4 hosts.

## Palavras-chave
traefik file provider, easypanel https-SERVICE-0, Host OR inject, tls.domains SAN, 172.17.0.1 host gateway, custom.yaml estático, restore-landing v6

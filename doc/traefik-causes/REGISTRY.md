# Registro de causas Traefik (WABA)

Cada incidente Traefik que causar desconexão deve ser registrado aqui.
O agente `@traefik-incident-specialist` **lê este arquivo primeiro**.

Formato de entrada:

```markdown
## ID: CAUSA-SLUG
- **Sintoma:**
- **Evidência:**
- **Causa raiz:**
- **Fix definitivo:**
- **Prevenção:**
- **Fontes:**
- **Primeiro visto:** YYYY-MM-DD
- **Reincidências:**
```

---

## ID: EP-WEBSECURE
- **Sintoma:** Host custom (ex.: `bet.waba.info`) retorna 404 SPA; outro domínio no mesmo Traefik OK
- **Evidência:** `main.yaml` com `entryPoints: ["web"]` / `["websecure"]`; env Traefik só define `http`/`https`; backend `:PORT` local 200
- **Causa raiz:** Routers órfãos — entryPoints que não existem no processo Traefik
- **Fix definitivo:** Trocar para `["http"]` / `["https"]`; espelhar `https-waba_paginadevendas-0`
- **Prevenção:** `scripts/infra/traefik-entrypoint-guard-vps.sh` (timer) + Rule `traefik-entrypoints-http-https.mdc`
- **Fontes:** https://doc.traefik.io/traefik/reference/install-configuration/entrypoints/ · `doc/TRAEFIK-ENTRYPOINTS-HTTP-HTTPS.md`
- **Primeiro visto:** 2026-07-10
- **Reincidências:** —

## ID: BACKEND-OVERLAY-502
- **Sintoma:** 502 Bad Gateway no HTTPS; curl local na porta host 200
- **Evidência:** service URL apontando para `tasks.*` / overlay que não resolve; `172.17.0.1:PORT` responde
- **Causa raiz:** Backend Swarm/overlay inválido no file provider
- **Fix definitivo:** `http://172.17.0.1:PORT/` no service do `main.yaml` (+ script restore)
- **Prevenção:** `restore-landing-routers-vps.sh` / guard `fix-backend`; heal login para `:30180`
- **Fontes:** doc Traefik services/loadbalancer · incidentes landings 2026-07-10
- **Primeiro visto:** 2026-07-10
- **Reincidências:** —

## ID: LOGIN-30180-PUBLISH
- **Sintoma:** Login WABA falha / HTTPS 502 após Redeploy Easypanel; utilizador acha que é senha
- **Evidência:** `ss` sem `:30180`; `curl 127.0.0.1:30180/health` falha ou porta sumiu; Traefik pode estar 1/1
- **Causa raiz:** Publish da porta host do serviço WABA perdido no redeploy
- **Fix definitivo:** `heal-waba-login-vps.sh run` (republica `:30180` + backends)
- **Prevenção:** `waba-login-heal.timer` / `waba-login-heal-watch` + Rule `waba-login-heal-pos-redeploy.mdc`
- **Fontes:** `doc/LOG-*-login-*.md`
- **Primeiro visto:** 2026-07-11
- **Reincidências:** —

## ID: TRAEFIK-THRASH-443
- **Sintoma:** Sites inteiros `000` / `:443` down; Traefik `0/1` em loop Assigned/Shutdown
- **Evidência:** vários timers `traefik-permanent-*-fix` + HUP/force simultâneos
- **Causa raiz:** Thrash de reload/restart na routing/static
- **Fix definitivo:** Desligar thrash; manter só bootstrap + `traefik-443-watchdog` + entrypoint-guard
- **Prevenção:** `permanent-all` v6+; nunca force Traefik com `1/1`+`:443` up
- **Fontes:** Rule `ucp-traefik-static-dynamic.mdc` · doc configuration-overview
- **Primeiro visto:** 2026-07-10
- **Reincidências:** —

## ID: ACME-JSON-INVALID
- **Sintoma:** Certificado `CN=Easypanel` / HTTPS com cert errado
- **Evidência:** `python3 -m json.tool acme.json` falha ou vazio corrompido
- **Causa raiz:** `acme.json` inválido
- **Fix definitivo:** Backup → `printf '{}\n' > acme.json` → chmod 600 → renovar domínio no Easypanel (TLS é dynamic)
- **Prevenção:** Não editar `acme.json` à mão sem backup; validar JSON após mudanças
- **Fontes:** https://doc.traefik.io/traefik/ (ACME / certificate resolvers)
- **Primeiro visto:** (histórico infra)
- **Reincidências:** —

---

## Template para nova causa

```markdown
## ID: NOVO-SLUG
- **Sintoma:**
- **Evidência:**
- **Causa raiz:**
- **Fix definitivo:**
- **Prevenção:**
- **Fontes:** (URLs do corpus + doc oficial)
- **Primeiro visto:** YYYY-MM-DD
- **Reincidências:** —
```

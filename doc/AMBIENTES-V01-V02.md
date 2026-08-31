# Ambientes WABA — Produção, V01 e V02

## URLs (mesmo domínio, subpastas — sem DNS extra)

| Ambiente | URL pública | URL local |
|----------|-------------|-----------|
| **Produção** | https://waba.draxsistemas.com.br/ | — |
| **V01** | https://waba.draxsistemas.com.br/version-01/ | http://localhost:3011/version-01/ |
| **V02** | https://waba.draxsistemas.com.br/version-02/ | http://localhost:3012/version-02/ |

Health:

- Produção: `/health`
- V01: `/version-01/health`
- V02: `/version-02/health`

Traefik no VPS: ver **[TRAEFIK-WABA-VERSION-PATHS.md](TRAEFIK-WABA-VERSION-PATHS.md)**.

---

## Visão geral

| Ambiente | Papel | Branch Git | `WABA_BASE_PATH` | UI (`WABA_UI_PROFILE`) | Dados |
|----------|-------|------------|------------------|------------------------|-------|
| **Produção** | Clientes reais | `master` | (vazio) | `production` (padrão) | volume `/app/data` |
| **V01** | Baseline técnico | `v01` | `/version-01` | `full` (menu completo) | `data/v01/` |
| **V02** | Dev diário (= UI prod) | `v02` | `/version-02` | `production` (igual prod) | `data/v02/` |

**Regra:** V01 e V02 **nunca** usam Evolution/Supabase de produção no PC local.

---

## Local (PC Windows)

```powershell
cd D:\Waba
npm run init:env   # primeira vez
npm run dev:v01    # baseline
npm run dev:v02    # dev diário
```

Abrir no navegador:

- V01: http://localhost:3011/version-01/
- V02: http://localhost:3012/version-02/

Validar:

```powershell
curl.exe http://localhost:3011/version-01/health
curl.exe http://localhost:3012/version-02/health
```

---

## Git — branches

| Branch | Uso |
|--------|-----|
| `v02` | Commits diários de desenvolvimento |
| `v01` | Staging / baseline validado |
| `master` | Produção |

Fluxo: `v02` → `v01` → `master` → deploy produção.

---

## VPS (Easypanel) — 3 serviços

| Serviço | Branch | Porta host | Env obrigatória |
|---------|--------|------------|-----------------|
| `waba_disparador` | `master` | 30180 | sem `WABA_BASE_PATH` |
| `waba_disparador_v01` | `v01` | 30190 | `WABA_BASE_PATH=/version-01` `WABA_ENV=v01` |
| `waba_disparador_v02` | `v02` | 30200 | `WABA_BASE_PATH=/version-02` `WABA_ENV=v02` `WABA_UI_PROFILE=production` |

Detalhes Traefik e `docker service update`: **TRAEFIK-WABA-VERSION-PATHS.md**.

---

## Checklist

- [ ] `.env.v01` / `.env.v02` com credenciais não-produção
- [ ] Serviços `_v01` e `_v02` no Easypanel
- [ ] Routers PathPrefix no Traefik
- [ ] Portas 30190 e 30200 publicadas no host

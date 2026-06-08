# Ambientes WABA — Produção, V01 e V02

## Visão geral

| Ambiente | Papel | Onde roda | Branch Git | Dados |
|----------|-------|-----------|------------|-------|
| **Produção** | Clientes reais | VPS `waba.draxsistemas.com.br` | `master` | volume `/app/data` |
| **V01** | Baseline congelado — igual ao que está em produção **hoje** | Local `localhost:3011` e/ou VPS `waba-v01.*` | `v01` | `data/v01/` ou volume próprio |
| **V02** | Desenvolvimento ativo — alterações **diárias** a partir de hoje | Local `localhost:3012` e/ou VPS `waba-v02.*` | `v02` | `data/v02/` ou volume próprio |

**Regra:** V01 e V02 **nunca** compartilham Evolution/Supabase de produção em desenvolvimento local.

---

## Local (PC Windows)

### 1. Criar ficheiros de ambiente

```powershell
cd D:\Waba
npm run init:env
```

Editar `.env.v01` e `.env.v02` com credenciais de **staging/dev** (não copiar produção).

### 2. Subir cada ambiente

```powershell
npm run dev:v01   # http://localhost:3011  — baseline
npm run dev:v02   # http://localhost:3012  — dev diário
```

### 3. Validar

```powershell
curl.exe http://localhost:3011/health
curl.exe http://localhost:3012/health
```

Resposta esperada: `"wabaEnv":"v01"` ou `"wabaEnv":"v02"`.

`ENABLE_BACKGROUND_PROCESSING=false` nos exemplos — campanhas e aquecedor **não** disparam sozinhos.

---

## Git — branches

```bash
# Uma vez: congelar baseline V01 no estado atual de produção
git checkout master
git pull
git branch v01
git tag v01-baseline-2026-06-08   # opcional

# V02 = trabalho diário (parte do mesmo ponto)
git checkout -b v02 v01
```

| Fluxo | Ação |
|-------|------|
| Dev diário | commit em `v02` |
| V02 estável → staging | merge `v02` → `v01` + deploy V01 no VPS |
| V01 validado → produção | merge `v01` → `master` + deploy produção |

---

## VPS (Easypanel) — serviços separados

Criar **dois serviços novos** no projeto `waba` (não reutilizar `waba_disparador` de produção):

| Serviço | Domínio sugerido | Porta host | Branch | `WABA_ENV` |
|---------|------------------|------------|--------|------------|
| `waba_disparador_v01` | `waba-v01.draxsistemas.com.br` | **30190** → 80 | `v01` | `v01` |
| `waba_disparador_v02` | `waba-v02.draxsistemas.com.br` | **30200** → 80 | `v02` | `v02` |

Variáveis em cada serviço (Easypanel → Ambiente):

```
WABA_ENV=v01   # ou v02
PORT=80
EVO_API_URL=http://172.17.0.1:30191   # Evolution dedicada V01 (exemplo)
ENABLE_BACKGROUND_PROCESSING=false    # V02; V01 pode true se quiser espelhar prod
```

Traefik `main.yaml` (após criar serviços):

```yaml
# V01
"url": "http://172.17.0.1:30190/"
# V02
"url": "http://172.17.0.1:30200/"
```

Republicar portas após cada redeploy:

```bash
docker service update --publish-add mode=host,published=30190,target=80,protocol=tcp waba_waba_disparador_v01
docker service update --publish-add mode=host,published=30200,target=80,protocol=tcp waba_waba_disparador_v02
```

### Evolution / Postgres / Redis

Para isolamento real, duplicar stack `walkup` (ou subir Evolution local no PC):

| Stack | Porta host API | Uso |
|-------|----------------|-----|
| Produção | 30181 | só produção |
| V01 | 30191 | staging baseline |
| V02 | 30201 | dev diário |

---

## Produção (inalterada)

- URL: `https://waba.draxsistemas.com.br`
- Serviço: `waba_waba_disparador` (porta **30180**)
- Branch: `master`
- Deploy só após validação em V01/V02

---

## Checklist rápido

- [ ] `npm run init:env` no PC
- [ ] `.env.v01` e `.env.v02` com Supabase/EVO **não-produção**
- [ ] Branches `v01` e `v02` criadas no GitHub
- [ ] Serviços Easypanel `waba_disparador_v01` e `_v02` (opcional VPS)
- [ ] Evolution separada por ambiente (recomendado)

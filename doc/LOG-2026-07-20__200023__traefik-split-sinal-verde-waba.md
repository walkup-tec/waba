# LOG — Separar Traefik: WABA vs Sinal Verde

**Data:** 2026-07-20 ~20:00  
**Contexto:** Isolar routing do CRM `acesso-sinalverde.com` do `main.yaml` WABA no mesmo Traefik Easypanel (`srv1261237`), para scripts SV não poderem derrubar disparos/bet/login.

## Doc oficial consultada

- https://doc.traefik.io/traefik/reference/install-configuration/providers/others/file/ — `filename` vs `directory` (mutuamente exclusivos); preferir `directory` + `watch`
- https://doc.traefik.io/traefik/getting-started/configuration-overview/ — static vs dynamic
- https://easypanel.io/docs/guides/custom-traefik-config — `custom.yaml` (sem routers dinâmicos neste VPS)

## Solução

| Arquivo | Papel |
|---------|--------|
| `main.yaml` | Só WABA + o que o Easypanel gerar |
| `sinal-verde.yaml` (novo) | Só routers/services Sinal Verde → `http://172.17.0.1:30310/` |
| `custom.yaml` | accessLog/api — sem `http.routers` |

### Scripts novos/atualizados

- `scripts/traefik-inspect-file-provider-vps.sh` — inspect-only do file provider
- `scripts/traefik-split-sinal-verde-yaml-vps.sh` — `inspect|run|strip-main|status` (directory se preciso + split)
- `scripts/fix-sinal-verde-traefik-safe-vps.sh` — v5: só `sinal-verde.yaml`
- `scripts/sinal-verde-overlay-guard-vps.sh` — v4: só `sinal-verde.yaml` + strip SV do main se Easypanel recriar
- `.github/workflows/traefik-split-sinal-verde.yml` — dispatch SSH no VPS
- Rules: `sinal-verde-heal-pos-redeploy.mdc`, `ucp-traefik-static-dynamic.mdc`

## Como validar no VPS

```bash
bash /root/waba-infra/traefik-split-sinal-verde-yaml-vps.sh inspect
bash /root/waba-infra/traefik-split-sinal-verde-yaml-vps.sh run
# Ordem: disparos 200 → bet 200 → health 200 → SV 200/307
```

Ou Actions: **Traefik Split Sinal Verde** → mode `run`.

## Segurança

- Sem segredos no repo
- Sem `--force` Traefik por hábito
- Abort/restore se WABA cair após split
- Proibido regex atravessando `main.yaml` para SV

## Keywords

`traefik-split`, `sinal-verde.yaml`, `file-provider-directory`, `acesso-sinalverde`, `main.yaml-isolation`, `30310`

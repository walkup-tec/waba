# LOG — WABA 404 Traefik router após redeploy

**Data:** 2026-06-08  
**Contexto:** Produção `https://waba.draxsistemas.com.br/` retorna 404 após deploy Easypanel.

## Sintomas

| Teste | Resultado |
|-------|-----------|
| `http://127.0.0.1:30180/health` | 200 |
| `grep waba.draxsistemas main.yaml` | vazio |
| `https://waba.draxsistemas.com.br/health` | 404 |
| `/root/traefik-permanent-waba-vps.sh run` | `waba:404 health:404` |

## Causa

Redeploy Easypanel removeu routers/serviço `waba.draxsistemas.com.br` de `/etc/easypanel/traefik/config/main.yaml`. App Node OK na porta 30180.

## Alterações nesta sessão

- `scripts/restore-waba-traefik-router-vps.sh` — merge cirúrgico dos blocos WABA a partir de `main.yaml.bak*`
- Commit `8adc236` em `master` e `v02`

## Tentativa 1 (falhou)

Script v1 fez merge cirúrgico: extraiu blocos do backup mas **não inseriu** (chaves `http-waba_waba_disparador-0` já existiam no `main.yaml` sem `Host(waba.draxsistemas…)`). Resultado: ainda HTTP 404.

## Comando VPS (correção — restore completo)

```bash
CFG=/etc/easypanel/traefik/config/main.yaml
BAK=/etc/easypanel/traefik/config/main.yaml.bak-waba-20260608-172040
cp -a "$CFG" "${CFG}.bak-before-full-restore-$(date +%Y%m%d-%H%M%S)"
cp -a "$BAK" "$CFG"
/root/traefik-permanent-waba-vps.sh run
```

Script v2 no repo: restore = `cp` backup inteiro + patch backend + `traefik-permanent-waba run`.

## Validação esperada

```bash
grep -n 'waba.draxsistemas' /etc/easypanel/traefik/config/main.yaml | head -5
curl -sS -o /dev/null -w "https:%{http_code}\n" https://waba.draxsistemas.com.br/health
```

→ grep com linhas; https:200

## Fallback

Se script falhar com "nenhum backup": Easypanel → projeto **waba** → serviço **waba_disparador** → **Domínios** → adicionar `waba.draxsistemas.com.br` → redeploy.

## Pendências

- Usuário executar restore no VPS e confirmar 200
- Opcional: cron/post-deploy para reexecutar restore ou permanent script

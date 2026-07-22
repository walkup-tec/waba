# LOG — Sinal Verde Traefik backend :3000

**Data:** 2026-07-20 ~12:15

## Contexto

VPS mostrou:
- `127.0.0.1:30310` → `000` (publish heal ausente)
- `127.0.0.1:3000` → `200` (app OK via publish Easypanel)
- Logs Postgres NOTICE “already exists, skipping” = harmless
- HTTPS público ainda 502 (Traefik apontava overlay / :30310)

## Solução

1. Backend canônico = `http://172.17.0.1:3000/`
2. Atualizado `heal-sinal-verde-pos-redeploy-vps.sh` (`SV_PUBLISHED_PORT` default 3000)
3. Atualizado CANONICAL em `restore-easypanel-traefik-backends-vps.sh`
4. Rule `.cursor/rules/sinal-verde-heal-pos-redeploy.mdc`

Commit WABA: `6f4f8dc`

## Validar no VPS

```bash
# Patch imediato Traefik → :3000 (file watch, sem HUP)
python3 - <<'PY'
from pathlib import Path
import re
p = Path("/etc/easypanel/traefik/config/main.yaml")
t = p.read_text()
# trocar qualquer backend sinal-verde para gateway:3000
t2 = re.sub(
    r'(url:\s*")http://[^"]+(")',
    lambda m: m.group(0),  # noop placeholder — use script abaixo
    t,
)
print("use restore script or manual replace")
PY

curl -fsSL "https://raw.githubusercontent.com/walkup-tec/waba/master/scripts/restore-easypanel-traefik-backends-vps.sh" \
  -o /tmp/restore-backends.sh
sed -i 's/\r$//' /tmp/restore-backends.sh
chmod +x /tmp/restore-backends.sh
bash /tmp/restore-backends.sh
# aguardar ~8–15s (file watch)
curl -sS -o /dev/null -w "public:%{http_code}\n" --max-time 15 https://acesso-sinalverde.com/
```

## Palavras-chave

sinal-verde, 3000, 30310, traefik backend, 172.17.0.1, 502

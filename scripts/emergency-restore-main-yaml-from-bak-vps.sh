#!/bin/bash
# Restaura main.yaml do backup ANTERIOR ao patch destrutivo do Sinal Verde.
# Para TODOS os guards SV. NÃO aplica patch novo — só copia bak.
set -euo pipefail
CFG=/etc/easypanel/traefik/config/main.yaml
DIR=$(dirname "$CFG")

echo "=== desligando guards Sinal Verde ==="
systemctl disable --now \
  sinal-verde-overlay-guard.timer \
  sinal-verde-overlay-guard-watch.service \
  sinal-verde-heal.timer \
  sinal-verde-heal-watch.service \
  2>/dev/null || true
rm -f /var/run/sinal-verde-overlay-guard.lock /var/run/heal-sinal-verde-pos-redeploy.lock 2>/dev/null || true

echo "=== backups disponíveis ==="
ls -lt "$DIR"/main.yaml.bak* 2>/dev/null | head -25 || true

# Preferência: bak-sv-safe (feito ANTES do regex amplo que derrubou WABA)
# Depois: qualquer bak válido com 30210+30211+wabadisparos e SEM 30310 em paginadevendas/bets
BEST=$(python3 - "$DIR" <<'PY'
import sys
from pathlib import Path
d = Path(sys.argv[1])
cands = []
for p in d.glob("main.yaml.bak*"):
    try:
        t = p.read_text(encoding="utf-8", errors="replace")
    except Exception:
        continue
    if t.count("{") != t.count("}"):
        continue
    if "wabadisparos.com.br" not in t:
        continue
    if "http://172.17.0.1:30210/" not in t:
        continue
    if "http://172.17.0.1:30211/" not in t:
        continue
    # rejeita se landing aponta para 30310 (estado corrompido pelo SV)
    bad = False
    for marker in ("waba_paginadevendas-0", "waba_bets_pv-0"):
        i = t.find(f'"{marker}"')
        if i < 0:
            continue
        chunk = t[i : i + 800]
        if "30310" in chunk:
            bad = True
            break
    if bad:
        continue
    score = p.stat().st_mtime
    name = p.name.lower()
    if "sv-safe" in name:
        score += 1_000_000  # preferir bak pré-patch SV
    if "broken" in name:
        score -= 5_000_000
    if "force-waba" in name or "waba-only" in name:
        score -= 1000  # pós-incidente, menos preferível que sv-safe
    cands.append((score, str(p)))
if not cands:
    print("")
    sys.exit(0)
cands.sort(reverse=True)
print(cands[0][1])
for s, p in cands[:8]:
    print(f"# cand {p}", file=sys.stderr)
PY
)

if [[ -z "$BEST" ]]; then
  echo "ERRO: nenhum backup válido encontrado"
  exit 1
fi

echo "=== restaurando de ==="
echo "$BEST"
cp -a "$CFG" "${CFG}.bak-before-restore-$(date +%s)"
cp -a "$BEST" "$CFG"
echo "restaurado. aguardando Traefik watch 15s..."
sleep 15

echo "=== validação ==="
curl -sk -o /dev/null -m 14 -w "disparos:%{http_code}\n" https://wabadisparos.com.br/ || true
curl -sk -o /dev/null -m 14 -w "bet:%{http_code}\n" https://bet.waba.info/ || true
curl -sk -o /dev/null -m 14 -w "health:%{http_code}\n" https://waba.draxsistemas.com.br/health || true

echo
echo "Guards SV DESLIGADOS. Não rode script de Sinal Verde."

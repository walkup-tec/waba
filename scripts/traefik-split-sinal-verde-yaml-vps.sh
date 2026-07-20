#!/bin/bash
# Separar Traefik: WABA em main.yaml | Sinal Verde em sinal-verde.yaml
#
# Doc:
#   https://doc.traefik.io/traefik/reference/install-configuration/providers/others/file/
#   https://doc.traefik.io/traefik/getting-started/configuration-overview/
#   https://easypanel.io/docs/guides/custom-traefik-config
#
# Ordem segura:
#   1) inspect file provider
#   2) se só filename → directory=/data/config + watch (sem --force)
#   3) criar sinal-verde.yaml; remover chaves SV do main.yaml
#   4) validar WABA 200 ANTES de exigir SV
#
# Uso:
#   bash /tmp/traefik-split-sinal-verde-yaml-vps.sh inspect
#   bash /tmp/traefik-split-sinal-verde-yaml-vps.sh run
#
# Versão: traefik-split-sinal-verde-2026-07-20-v1
set -euo pipefail

VERSION="traefik-split-sinal-verde-2026-07-20-v1"
CFG_DIR="${TRAEFIK_CFG_DIR:-/etc/easypanel/traefik/config}"
MAIN="${CFG_DIR}/main.yaml"
SV_YAML="${CFG_DIR}/sinal-verde.yaml"
CUSTOM="${CFG_DIR}/custom.yaml"
# Path DENTRO do container (mount /etc/easypanel/traefik → /data)
CONTAINER_CFG_DIR="${TRAEFIK_CONTAINER_CFG_DIR:-/data/config}"
LOG="${TRAEFIK_SPLIT_LOG:-/var/log/traefik-split-sinal-verde.log}"
CRM="sinal-verde_acesso-sinalverde"
HOST_PORT=30310
URL="http://172.17.0.1:${HOST_PORT}/"
DOMAIN="acesso-sinalverde.com"
TS="$(date +%Y%m%d%H%M%S)"

log() { printf '[%s] [%s] %s\n' "$(date -Is)" "$VERSION" "$*" | tee -a "$LOG"; }
die() { log "ERRO: $*"; exit 1; }
http_code() { curl -sS -o /dev/null -w '%{http_code}' --max-time 12 "$@" 2>/dev/null || echo 000; }

need_root() { [[ "$(id -u)" -eq 0 ]] || die "rode como root"; }

traefik_cid() {
  docker ps -q -f name=easypanel-traefik -f status=running | head -1 || true
}

service_env() {
  docker service inspect easypanel-traefik --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' 2>/dev/null || true
}

detect_mode() {
  local env_all
  env_all="$(service_env)"
  if echo "$env_all" | grep -qiE '^TRAEFIK_PROVIDERS_FILE_DIRECTORY='; then
    echo "directory"
    return
  fi
  if echo "$env_all" | grep -qiE '^TRAEFIK_PROVIDERS_FILE_FILENAME='; then
    echo "filename"
    return
  fi
  local cid
  cid="$(traefik_cid)"
  if [[ -n "$cid" ]]; then
    local cenv
    cenv="$(docker inspect "$cid" --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null || true)"
    if echo "$cenv" | grep -qiE '^TRAEFIK_PROVIDERS_FILE_DIRECTORY='; then
      echo "directory"
      return
    fi
    if echo "$cenv" | grep -qiE '^TRAEFIK_PROVIDERS_FILE_FILENAME='; then
      echo "filename"
      return
    fi
  fi
  # Easypanel: main.yaml + custom.yaml no mesmo dir → directory-likely
  local n
  n="$(find "$CFG_DIR" -maxdepth 1 -type f \( -name '*.yml' -o -name '*.yaml' \) 2>/dev/null | wc -l | tr -d ' ')"
  if [[ "${n:-0}" -ge 2 ]]; then
    echo "directory-likely"
  else
    echo "filename-likely"
  fi
}

validate_waba() {
  local d b h
  d="$(http_code "https://wabadisparos.com.br/")"
  b="$(http_code "https://bet.waba.info/")"
  h="$(http_code "https://waba.draxsistemas.com.br/health")"
  log "WABA check: disparos=${d} bet=${b} health=${h}"
  [[ "$d" == "200" && "$b" == "200" && "$h" == "200" ]]
}

validate_sv() {
  local c
  c="$(http_code "https://${DOMAIN}/")"
  log "SV check: ${DOMAIN}=${c}"
  [[ "$c" == "200" || "$c" == "307" || "$c" == "302" || "$c" == "301" ]]
}

cmd_inspect() {
  need_root
  mkdir -p "$(dirname "$LOG")"
  log "=== inspect ==="
  ls -la "$CFG_DIR" | tee -a "$LOG" || true
  local mode
  mode="$(detect_mode)"
  log "MODE=$mode"
  service_env | grep -iE 'PROVIDERS_FILE|FILE_FILENAME|FILE_DIRECTORY|FILE_WATCH' | tee -a "$LOG" || log "(sem TRAEFIK_PROVIDERS_FILE_* no service)"
  if [[ -f "$MAIN" ]]; then
    log "chaves SV em main.yaml:"
    grep -oE '"[^"]*(sinal-verde|acesso-sinalverde)[^"]*"' "$MAIN" 2>/dev/null | sort -u | tee -a "$LOG" || log "(nenhuma)"
  fi
  if [[ -f "$SV_YAML" ]]; then
    log "sinal-verde.yaml já existe ($(wc -c < "$SV_YAML") bytes)"
  else
    log "sinal-verde.yaml ainda não existe"
  fi
  validate_waba || log "AVISO: WABA não está 200 agora — NÃO rode migrate até WABA OK"
  echo "MODE=$mode"
}

# Neutraliza custom.yaml se tiver só config estática (accessLog/api) — directory provider
# carrega tudo como dinâmico; static keys quebram o file provider.
# ACCESSLOG já está false via env do serviço (LOG 2026-06-27).
neutralize_custom_if_static() {
  [[ -f "$CUSTOM" ]] || return 0
  if grep -qE '^\s*(http|tcp|udp|tls)\s*:' "$CUSTOM" 2>/dev/null; then
    log "custom.yaml tem http/tcp/udp/tls — mantém (dinâmico)"
    return 0
  fi
  if grep -qiE 'accessLog|^\s*api\s*:|^\s*log\s*:' "$CUSTOM" 2>/dev/null; then
    local bak="${CUSTOM}.static-disabled-${TS}"
    cp -a "$CUSTOM" "$bak"
    # Arquivo vazio dinâmico válido — ou remove do dir
    mv -f "$CUSTOM" "$bak"
    log "custom.yaml (estático) movido para $bak — env ACCESSLOG já cobre"
  fi
}

enable_directory_provider() {
  local mode force="${1:-}"
  mode="$(detect_mode)"

  if [[ "$mode" == "directory" && "$force" != "force" ]]; then
    log "file provider = directory (confirmado)"
    if ! service_env | grep -qiE '^TRAEFIK_PROVIDERS_FILE_WATCH=true'; then
      log "adicionando WATCH=true (rolling restart curto)"
      docker service update --detach=false \
        --env-add "TRAEFIK_PROVIDERS_FILE_WATCH=true" \
        easypanel-traefik >>"$LOG" 2>&1 || true
      sleep 8
      validate_waba || die "WABA falhou após WATCH=true"
    fi
    return 0
  fi

  if [[ "$mode" == "directory-likely" && "$force" != "force" ]]; then
    log "MODE=directory-likely — assume Easypanel já carrega config/; sem restart agora"
    return 0
  fi

  # filename | filename-likely | unknown | force
  log "Ativando providers.file.directory=${CONTAINER_CFG_DIR} (mode=$mode force=$force)"
  neutralize_custom_if_static

  docker service update --detach=false \
    --env-rm TRAEFIK_PROVIDERS_FILE_FILENAME \
    --env-add "TRAEFIK_PROVIDERS_FILE_DIRECTORY=${CONTAINER_CFG_DIR}" \
    --env-add "TRAEFIK_PROVIDERS_FILE_WATCH=true" \
    easypanel-traefik >>"$LOG" 2>&1 || die "falha ao atualizar env do Traefik"

  log "aguardando Traefik 1/1 + :443..."
  local i
  for i in $(seq 1 60); do
    local rep
    rep="$(docker service ls --filter name=easypanel-traefik --format '{{.Replicas}}' 2>/dev/null | head -1 || true)"
    if [[ "$rep" == "1/1" ]] && ss -tln | grep -q ':443 '; then
      sleep 5
      if validate_waba; then
        log "directory provider OK — WABA 200"
        return 0
      fi
    fi
    sleep 3
  done
  die "após directory provider, WABA não voltou 200 — abort (não remove SV do main)"
}

# Extrai blocos SV do main → sinal-verde.yaml; remove do main
python_split() {
  python3 - "$MAIN" "$SV_YAML" "$URL" <<'PY'
import re, sys, json
from pathlib import Path

main_path = Path(sys.argv[1])
sv_path = Path(sys.argv[2])
url = sys.argv[3]
text = main_path.read_text(encoding="utf-8")
if text.count("{") != text.count("}"):
    print("ABORT: braces main.yaml", file=sys.stderr)
    sys.exit(2)

def extract_block(text, start):
    brace = text.find("{", start)
    if brace < 0:
        raise RuntimeError("no brace")
    depth = 0
    for i, ch in enumerate(text[brace:], brace):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[start:i+1], start, i+1
    raise RuntimeError("unbalanced")

# Chaves cujo NOME indica Sinal Verde (nunca waba_*)
def is_sv_key(key: str) -> bool:
    k = key.lower()
    if k.startswith("waba_"):
        return False
    return ("sinal-verde" in k) or ("acesso-sinalverde" in k) or ("sinalverde" in k)

# Encontrar todas as chaves top-level no objeto raiz: "key": {
# Formato Easypanel: JSON-like com aspas nas chaves
key_re = re.compile(r'"([^"]+)"\s*:\s*\{')

blocks = []  # (key, block_text, start, end)
idx = 0
# Skip até o primeiro { do root
root = text.find("{")
if root < 0:
    print("ABORT: no root", file=sys.stderr)
    sys.exit(2)

# Percorrer só chaves de primeiro nível do root
i = root + 1
depth = 1
while i < len(text) and depth > 0:
    ch = text[i]
    if ch == "{":
        depth += 1
        i += 1
        continue
    if ch == "}":
        depth -= 1
        i += 1
        continue
    if depth == 1 and ch == '"':
        m = key_re.match(text, i)
        if m:
            key = m.group(1)
            block, a, b = extract_block(text, i)
            if is_sv_key(key):
                blocks.append((key, block, a, b))
            i = b
            continue
    i += 1

if not blocks:
    # Se sinal-verde.yaml já existe, só garantir que main não tem SV
    print("no_sv_keys_in_main=1")
    if sv_path.exists() and sv_path.stat().st_size > 10:
        print(f"sv_yaml_exists={sv_path}")
        sys.exit(0)
    # Criar yaml mínimo canônico
    content = {
        "http-sinal-verde_acesso-sinalverde-0": {
            "entryPoints": ["http"],
            "service": "sinal-verde_acesso-sinalverde-0",
            "rule": "Host(`acesso-sinalverde.com`) || Host(`www.acesso-sinalverde.com`)",
            "middlewares": ["redirect-to-https"]
        },
        "https-sinal-verde_acesso-sinalverde-0": {
            "entryPoints": ["https"],
            "service": "sinal-verde_acesso-sinalverde-0",
            "rule": "Host(`acesso-sinalverde.com`) || Host(`www.acesso-sinalverde.com`)",
            "tls": {"certResolver": "letsencrypt"},
            "middlewares": []
        },
        "sinal-verde_acesso-sinalverde-0": {
            "loadBalancer": {
                "servers": [{"url": url}],
                "passHostHeader": True
            }
        }
    }
    # Easypanel usa JSON-like com aspas — escrever como JSON pretty (Traefik aceita YAML/JSON)
    sv_path.write_text(json.dumps(content, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"created_minimal={sv_path}")
    sys.exit(0)

# Remover blocos do main de trás pra frente
new_text = text
for key, block, a, b in sorted(blocks, key=lambda x: x[2], reverse=True):
    # Incluir vírgula anterior ou posterior
    start, end = a, b
    # trim trailing comma/whitespace after block
    j = end
    while j < len(new_text) and new_text[j] in " \t\r\n":
        j += 1
    if j < len(new_text) and new_text[j] == ",":
        end = j + 1
    else:
        # maybe comma before
        k = start - 1
        while k >= 0 and new_text[k] in " \t\r\n":
            k -= 1
        if k >= 0 and new_text[k] == ",":
            start = k
    new_text = new_text[:start] + new_text[end:]
    print(f"moved={key}")

if new_text.count("{") != new_text.count("}"):
    print("ABORT: braces after remove", file=sys.stderr)
    sys.exit(2)

# Abort se WABA keys sumiram
for must in ("waba_paginadevendas-0", "wabadisparos"):
    if must not in new_text and "waba_paginadevendas" not in new_text:
        # soft: só exige pelo menos um marker WABA conhecido
        pass
if "waba_" not in new_text and "wabadisparos" not in new_text:
    print("ABORT: main.yaml sem markers WABA após remoção", file=sys.stderr)
    sys.exit(3)

# Montar sinal-verde.yaml a partir dos blocos (forçar URL canônica nos services)
sv_parts = []
for key, block, _, _ in blocks:
    # Só services loadBalancer: forçar url
    if "loadBalancer" in block and '"url"' in block:
        block = re.sub(r'("url"\s*:\s*")[^"]+(")', rf"\g<1>{url}\2", block, count=1)
    # entryPoints: nunca web/websecure
    block = block.replace('"websecure"', '"https"').replace('"web"', '"http"')
    block = re.sub(r"\bwebsecure\b", "https", block)
    # cuidado: não substituir "web" dentro de palavras — já fizemos quoted
    sv_parts.append(block)

# Se já existir sv yaml, merge keys (substituir pelas do main)
existing = {}
if sv_path.exists():
    raw = sv_path.read_text(encoding="utf-8").strip()
    if raw:
        # Tentar parse JSON-like
        try:
            existing = json.loads(raw)
        except Exception:
            existing = {}

# Parse moved blocks into dict via wrapping
wrapped = "{\n" + ",\n".join(sv_parts) + "\n}\n"
try:
    moved = json.loads(wrapped)
except Exception as e:
    # fallback: write raw object
    main_path.write_text(new_text, encoding="utf-8")
    sv_path.write_text(wrapped, encoding="utf-8")
    print(f"wrote_raw_sv err={e}")
    print(f"main_keys_removed={len(blocks)}")
    sys.exit(0)

# Force service URLs
for k, v in list(moved.items()):
    if isinstance(v, dict) and "loadBalancer" in v:
        try:
            v["loadBalancer"]["servers"] = [{"url": url}]
        except Exception:
            pass
    # entryPoints fix
    if isinstance(v, dict) and "entryPoints" in v:
        eps = v["entryPoints"]
        if isinstance(eps, list):
            v["entryPoints"] = [
                "https" if x in ("websecure", "web-secure") else ("http" if x == "web" else x)
                for x in eps
            ]

existing.update(moved)
sv_path.write_text(json.dumps(existing, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
main_path.write_text(new_text, encoding="utf-8")
print(f"main_keys_removed={len(blocks)}")
print(f"sv_yaml={sv_path}")
PY
}

ensure_publish() {
  docker service ls --format '{{.Name}}' | grep -qx "$CRM" || {
    log "AVISO: serviço $CRM não encontrado — skip publish"
    return 0
  }
  local ports
  ports="$(docker service inspect "$CRM" --format '{{json .Endpoint.Ports}}' 2>/dev/null || echo '[]')"
  if echo "$ports" | grep -q "\"PublishedPort\":${HOST_PORT}"; then
    log "publish :${HOST_PORT} OK"
    return 0
  fi
  log "publicando :${HOST_PORT}→3000"
  docker service update --publish-rm "${HOST_PORT}" "$CRM" >>"$LOG" 2>&1 || true
  timeout 90 docker service update \
    --publish-add "mode=host,published=${HOST_PORT},target=3000,protocol=tcp" \
    "$CRM" >>"$LOG" 2>&1 || log "AVISO: publish falhou"
  sleep 4
}

cmd_run() {
  need_root
  mkdir -p "$(dirname "$LOG")" "$CFG_DIR"
  log "=== run split WABA / Sinal Verde ==="

  [[ -f "$MAIN" ]] || die "main.yaml ausente: $MAIN"

  if ! validate_waba; then
    die "WABA não está 200 — abort antes de qualquer mudança"
  fi

  local mode
  mode="$(detect_mode)"
  log "MODE inicial=$mode"

  # Backup
  cp -a "$MAIN" "${MAIN}.bak-split-sv-${TS}"
  [[ -f "$SV_YAML" ]] && cp -a "$SV_YAML" "${SV_YAML}.bak-${TS}" || true
  log "backup main → ${MAIN}.bak-split-sv-${TS}"

  # 1) directory provider se necessário (filename → directory; directory-likely sem restart)
  enable_directory_provider
  if ! validate_waba; then
    die "WABA quebrou após enable directory — restore manual do backup"
  fi

  # 2) publish CRM
  ensure_publish
  local local_code
  local_code="$(http_code "http://127.0.0.1:${HOST_PORT}/")"
  log "local :${HOST_PORT}=${local_code}"

  # 3) split yaml
  log "extraindo SV → sinal-verde.yaml e removendo do main.yaml"
  python_split

  # 4) NÃO HUP / NÃO force — watch ~8s
  sleep 10

  if ! validate_waba; then
    log "WABA falhou após split — restaurando main.yaml do backup"
    cp -a "${MAIN}.bak-split-sv-${TS}" "$MAIN"
    sleep 10
    validate_waba || die "restore main não recuperou WABA"
    die "split revertido; investigue sinal-verde.yaml"
  fi

  log "WABA OK após split"
  if validate_sv; then
    log "SV OK"
  else
    log "SV ainda não OK — tentando forçar directory provider (sinal-verde.yaml pode não estar carregado)"
    enable_directory_provider force
    sleep 10
    if ! validate_waba; then
      log "WABA falhou após force directory — restaurando main"
      cp -a "${MAIN}.bak-split-sv-${TS}" "$MAIN"
      sleep 10
      die "abort após force directory"
    fi
    validate_sv && log "SV OK após directory force" || log "AVISO: SV ainda falha — rode guard; WABA isolado OK"
  fi

  # Garantir main sem chaves SV
  if grep -qiE 'sinal-verde|acesso-sinalverde' "$MAIN" 2>/dev/null; then
    log "AVISO: ainda há menções SV no main.yaml — rode strip-sv-from-main"
  else
    log "main.yaml limpo de Sinal Verde"
  fi

  log "DONE MODE=$(detect_mode) sv_yaml=$SV_YAML"
}

# Remove só chaves SV do main (Easypanel pode recriar) — não toca WABA
cmd_strip_main() {
  need_root
  [[ -f "$MAIN" ]] || die "main ausente"
  if ! grep -qiE 'sinal-verde|acesso-sinalverde' "$MAIN"; then
    log "main já sem SV"
    exit 0
  fi
  cp -a "$MAIN" "${MAIN}.bak-strip-sv-${TS}"
  python_split
  sleep 8
  validate_waba || {
    cp -a "${MAIN}.bak-strip-sv-${TS}" "$MAIN"
    die "strip quebrou WABA — restaurado"
  }
  log "strip OK"
}

cmd_status() {
  need_root
  log "MODE=$(detect_mode)"
  log "main=$( [[ -f $MAIN ]] && wc -c < "$MAIN" || echo missing ) bytes"
  log "sv=$( [[ -f $SV_YAML ]] && wc -c < "$SV_YAML" || echo missing )"
  grep -qiE 'sinal-verde|acesso-sinalverde' "$MAIN" 2>/dev/null && log "main AINDA tem SV" || log "main limpo SV"
  validate_waba && log "WABA=OK" || log "WABA=FAIL"
  validate_sv && log "SV=OK" || log "SV=FAIL"
}

case "${1:-}" in
  inspect) cmd_inspect ;;
  run) cmd_run ;;
  strip-main|strip) cmd_strip_main ;;
  status) cmd_status ;;
  *)
    echo "Uso: $0 {inspect|run|strip-main|status}"
    exit 1
    ;;
esac

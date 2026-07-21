#!/bin/bash
# Guardião de Sistemas — instalador/orquestrador do único writer do main.yaml.
# Uso: install-audit|activate|audit|repair|status|rollback|uninstall|daemon
# Nunca envia HUP nem força/reinicia o Traefik.
set -euo pipefail

VERSION="guardiao-sistemas-traefik-2026-07-21-v1"
INSTALL_DIR="${GUARDIAN_HOME:-/root/waba-infra/guardiao-sistemas}"
SELF="/root/waba-infra/guardiao-sistemas-traefik-vps.sh"
ENGINE="${INSTALL_DIR}/guardiao-sistemas-traefik-vps.py"
REGISTRY="${INSTALL_DIR}/registry.json"
ENV_FILE="/etc/default/guardiao-sistemas-traefik"
UNIT="/etc/systemd/system/guardiao-sistemas-traefik.service"
LOG="/var/log/guardiao-sistemas-traefik-install.log"
REPO_RAW="${WABA_REPO_RAW:-https://raw.githubusercontent.com/walkup-tec/waba/master/scripts}"

log() { printf '[%s] [%s] %s\n' "$(date -Is)" "$VERSION" "$*" | tee -a "$LOG"; }
need_root() { [[ "$(id -u)" -eq 0 ]] || { log "ERRO: execute como root"; exit 1; }; }

install_asset() {
  local name="$1" destination="$2" source_dir
  source_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  if [[ -f "${source_dir}/${name}" ]]; then
    cp -f "${source_dir}/${name}" "$destination"
  else
    curl -fsSL "${REPO_RAW}/${name}" -o "$destination"
  fi
  sed -i 's/\r$//' "$destination" 2>/dev/null || true
}

install_assets() {
  mkdir -p "$INSTALL_DIR" /root/waba-infra /var/lib/guardiao-sistemas-traefik
  install_asset "guardiao-sistemas-traefik-vps.py" "$ENGINE"
  install_asset "guardiao-sistemas-traefik-registry.json" "$REGISTRY"
  chmod 0755 "$ENGINE"
  python3 -m json.tool "$REGISTRY" >/dev/null
  python3 -m py_compile "$ENGINE"
  local source_self
  source_self="$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")"
  if [[ "$source_self" != "$SELF" ]]; then
    cp -f "$source_self" "$SELF"
  fi
  sed -i 's/\r$//' "$SELF"
  chmod 0755 "$SELF"
}

write_unit() {
  cat >"$UNIT" <<EOF
[Unit]
Description=Guardiao de Sistemas - Traefik/Easypanel transacional
Documentation=https://doc.traefik.io/traefik/reference/install-configuration/providers/others/file/
After=docker.service
Wants=docker.service

[Service]
Type=simple
EnvironmentFile=-${ENV_FILE}
ExecStart=${SELF} daemon
Restart=always
RestartSec=3
KillSignal=SIGTERM
TimeoutStopSec=15
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
}

set_mode() {
  local mode="$1"
  cat >"$ENV_FILE" <<EOF
GUARDIAN_MODE=${mode}
GUARDIAN_HOME=${INSTALL_DIR}
GUARDIAN_REGISTRY=${REGISTRY}
EOF
}

engine() {
  GUARDIAN_HOME="$INSTALL_DIR" GUARDIAN_REGISTRY="$REGISTRY" python3 "$ENGINE" "$@"
}

cmd_install_audit() {
  need_root
  install_assets
  write_unit
  set_mode audit
  systemctl enable --now guardiao-sistemas-traefik.service
  sleep 3
  log "instalado em AUDIT — nenhuma escrita automática"
  cmd_status
}

disable_legacy_writers() {
  local units=(
    sinal-verde-overlay-guard.timer
    sinal-verde-overlay-guard-watch.service
    sinal-verde-overlay-guard.service
    soma-crm-overlay-guard.timer
    soma-crm-overlay-guard-watch.service
    soma-crm-overlay-guard.service
    waba-traefik-entrypoint-guard.timer
    waba-traefik-entrypoint-guard.service
    traefik-easypanel-config-guard.service
    traefik-permanent-paginadevendas-fix.timer
    traefik-permanent-bets-pv-fix.timer
    traefik-permanent-waba-fix.timer
    traefik-permanent-walkup-evo-fix.timer
    traefik-permanent-paginadevendas-watch
    traefik-permanent-bets-pv-watch
    traefik-permanent-waba-watch
    traefik-permanent-walkup-evo-watch
    restore-easypanel.timer
    soma-heal.timer
  )
  log "desativando writers legados concorrentes (best-effort)"
  systemctl disable --now "${units[@]}" 2>/dev/null || true
}

refresh_publish_heals() {
  # Estes heals são publish-only nas versões compatíveis com o Guardião.
  local name
  for name in \
    heal-paginadevendas-pos-redeploy-vps.sh \
    heal-bets-pos-redeploy-vps.sh \
    heal-waba-login-vps.sh; do
    if curl -fsSL "${REPO_RAW}/${name}" -o "/root/waba-infra/${name}.new"; then
      sed -i 's/\r$//' "/root/waba-infra/${name}.new"
      if grep -qE 'docker kill -s HUP|restore-easypanel-traefik-backends' "/root/waba-infra/${name}.new"; then
        rm -f "/root/waba-infra/${name}.new"
        log "ERRO: ${name} ainda escreve/recarrega Traefik; activate abortado"
        return 1
      fi
      mv -f "/root/waba-infra/${name}.new" "/root/waba-infra/${name}"
      chmod 0755 "/root/waba-infra/${name}"
    else
      log "ERRO: download ${name}"
      return 1
    fi
  done
}

cmd_activate() {
  need_root
  install_assets
  write_unit
  log "pré-auditoria"
  engine audit || [[ "$?" -eq 1 ]] || return 1
  refresh_publish_heals
  disable_legacy_writers
  set_mode repair
  systemctl enable guardiao-sistemas-traefik.service
  systemctl restart guardiao-sistemas-traefik.service
  engine repair || true
  sleep 2
  log "Guardião ATIVO (repair)"
  cmd_status
}

cmd_status() {
  echo "mode=$(awk -F= '/^GUARDIAN_MODE=/{print $2}' "$ENV_FILE" 2>/dev/null || echo not-installed)"
  systemctl is-active guardiao-sistemas-traefik.service 2>/dev/null || true
  echo "--- state ---"
  if [[ -f /var/lib/guardiao-sistemas-traefik/state.json ]]; then
    python3 -m json.tool /var/lib/guardiao-sistemas-traefik/state.json
  else
    echo "(sem state)"
  fi
  echo "--- probes ---"
  for url in \
    https://waba.draxsistemas.com.br/health \
    https://wabadisparos.com.br/ \
    https://bet.waba.info/ \
    https://acesso-sinalverde.com/ \
    https://app.somaconecta.com.br/api/health; do
    curl -sk -o /dev/null -m 12 -w "%{http_code} ${url}\n" "$url" || true
  done
}

cmd_rollback() {
  need_root
  systemctl stop guardiao-sistemas-traefik.service 2>/dev/null || true
  engine rollback
  set_mode audit
  systemctl start guardiao-sistemas-traefik.service
  log "rollback concluído; Guardião voltou para AUDIT"
}

cmd_uninstall() {
  need_root
  systemctl disable --now guardiao-sistemas-traefik.service 2>/dev/null || true
  rm -f "$UNIT" "$ENV_FILE"
  systemctl daemon-reload
  log "serviço removido; backups preservados em /etc/easypanel/traefik/config/.guardiao-backups"
}

cmd_daemon() {
  local mode="${GUARDIAN_MODE:-audit}"
  exec env GUARDIAN_HOME="$INSTALL_DIR" GUARDIAN_REGISTRY="$REGISTRY" \
    python3 "$ENGINE" daemon --mode "$mode"
}

case "${1:-}" in
  install-audit) cmd_install_audit ;;
  activate) cmd_activate ;;
  audit) need_root; install_assets; engine audit ;;
  repair) need_root; install_assets; engine repair ;;
  status) cmd_status ;;
  rollback) cmd_rollback ;;
  uninstall) cmd_uninstall ;;
  daemon) cmd_daemon ;;
  *)
    echo "Uso: $0 install-audit|activate|audit|repair|status|rollback|uninstall"
    exit 1
    ;;
esac

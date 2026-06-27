#!/usr/bin/env bash
# Coleta métricas CPU VPS e grava em /app/data/vps-infra/cpu-samples.jsonl (container WABA)
# Uso (host root): bash collect-vps-cpu-metrics-for-waba.sh
# Versão: waba-cpu-collector-2026-06-27-v1
set -euo pipefail

find_waba_container() {
  docker ps -q -f name=waba_waba_disparador -f status=running 2>/dev/null | head -1
}

main() {
  local cid
  cid="$(find_waba_container)"
  if [[ -z "$cid" ]]; then
    echo "[cpu-collector] WABA container not running — skip" >&2
    exit 0
  fi

  if ! command -v python3 >/dev/null 2>&1; then
    echo "[cpu-collector] python3 required" >&2
    exit 1
  fi

  python3 - "$cid" <<'PY'
import json, subprocess, sys, datetime

cid = sys.argv[1]

def sh(cmd):
    return subprocess.check_output(cmd, shell=True, text=True, stderr=subprocess.DEVNULL).strip()

load_s = sh("uptime | awk -F'load average:' '{print $2}' | awk -F, '{print $1}'").strip()
cores = max(1, int(sh("nproc") or "1"))
load = float(load_s or "0")
host_cpu = min(100.0, round(load / cores * 100, 2))

containers = []
try:
    stats_out = sh("docker stats --no-stream --format '{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}'")
    for line in stats_out.splitlines():
        if not line.strip():
            continue
        parts = line.split("|", 2)
        if len(parts) < 2:
            continue
        name = parts[0].strip()
        cpu_raw = parts[1].replace("%", "").strip()
        mem = parts[2].strip() if len(parts) > 2 else ""
        try:
            cpu = float(cpu_raw)
        except ValueError:
            cpu = 0.0
        containers.append({"name": name, "cpuPct": cpu, "mem": mem})
except Exception:
    pass

containers.sort(key=lambda x: -x.get("cpuPct", 0))
containers = containers[:30]

try:
    swarm_count = len([l for l in sh("docker service ls --format '{{.Name}}'").splitlines() if l.strip()])
except Exception:
    swarm_count = 0

sample = {
    "ts": datetime.datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
    "hostLoad1m": load,
    "cpuCores": cores,
    "hostCpuPctEst": host_cpu,
    "containers": containers,
    "swarmServiceCount": swarm_count,
}

payload = json.dumps(sample, separators=(",", ":"))
node = f"""
const fs = require('fs');
const p = '/app/data/vps-infra/cpu-samples.jsonl';
fs.mkdirSync('/app/data/vps-infra', {{ recursive: true }});
fs.appendFileSync(p, {json.dumps(payload)} + '\\n');
const lines = fs.readFileSync(p, 'utf8').trim().split('\\n').filter(Boolean);
if (lines.length > 10080) {{
  fs.writeFileSync(p, lines.slice(-10080).join('\\n') + '\\n');
}}
"""
subprocess.run(["docker", "exec", cid, "node", "-e", node], check=True)
print(f"[cpu-collector] ok hostCpu={host_cpu}% containers={len(containers)}")
PY
}

main "$@"

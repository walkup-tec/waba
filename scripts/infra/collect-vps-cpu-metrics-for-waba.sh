#!/usr/bin/env bash
# Coleta métricas VPS (CPU real, memória, disco) → /app/data/vps-infra/cpu-samples.jsonl
# Uso (host root): bash collect-vps-cpu-metrics-for-waba.sh
# Versão: waba-cpu-collector-2026-06-27-v3
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
import json, subprocess, sys, datetime, time

cid = sys.argv[1]

def sh(cmd):
    return subprocess.check_output(cmd, shell=True, text=True, stderr=subprocess.DEVNULL).strip()

def parse_loads():
    part = sh("uptime | awk -F'load average:' '{print $2}'")
    values = []
    for chunk in part.split(","):
        try:
            values.append(float(chunk.strip()))
        except ValueError:
            pass
    while len(values) < 3:
        values.append(values[-1] if values else 0.0)
    return values[:3]

def read_cpu_jiffies():
    with open("/proc/stat", encoding="utf-8") as f:
        line = f.readline()
    parts = line.split()
    if len(parts) < 5 or parts[0] != "cpu":
        return 0, 0
    nums = [int(x) for x in parts[1:]]
    while len(nums) < 7:
        nums.append(0)
    idle = nums[3] + nums[4]
    total = sum(nums[:7])
    return idle, total

def parse_host_cpu_pct():
    idle1, total1 = read_cpu_jiffies()
    time.sleep(0.2)
    idle2, total2 = read_cpu_jiffies()
    dt_total = total2 - total1
    dt_idle = idle2 - idle1
    if dt_total <= 0:
        return 0.0
    usage = (1.0 - (dt_idle / dt_total)) * 100.0
    return round(max(0.0, min(100.0, usage)), 2)

def parse_mem():
    info = {}
    try:
        with open("/proc/meminfo", encoding="utf-8") as f:
            for line in f:
                if ":" not in line:
                    continue
                key, raw = line.split(":", 1)
                bits = raw.strip().split()
                if not bits:
                    continue
                info[key.strip()] = int(bits[0]) * 1024
    except OSError:
        info = {}

    total = int(info.get("MemTotal") or 0)
    available = int(info.get("MemAvailable") or info.get("MemFree") or 0)
    if total <= 0:
        try:
            line = sh("free -b | awk '/^Mem:/ {print $2,$7}'")
            parts = line.split()
            if len(parts) >= 2:
                total = int(parts[0])
                available = int(parts[1])
        except Exception:
            pass

    used = max(0, total - available) if total > 0 else 0
    pct = round(used / total * 100, 2) if total else 0.0
    return used, total, pct

def parse_disk():
    try:
        line = sh("df -B1 --output=size,used / 2>/dev/null | tail -1")
        parts = line.split()
        if len(parts) >= 2:
            total = int(parts[0])
            used = int(parts[1])
            pct = round(used / total * 100, 2) if total else 0.0
            return used, total, pct
    except Exception:
        pass
    try:
        line = sh("df -B1 / | awk 'NR==2 {print $2,$3}'")
        parts = line.split()
        if len(parts) >= 2:
            total = int(parts[0])
            used = int(parts[1])
            pct = round(used / total * 100, 2) if total else 0.0
            return used, total, pct
    except Exception:
        pass
    return 0, 0, 0.0

load1, load5, load15 = parse_loads()
cores = max(1, int(sh("nproc") or "1"))
host_cpu = parse_host_cpu_pct()
mem_used, mem_total, mem_pct = parse_mem()
disk_used, disk_total, disk_pct = parse_disk()

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
    "hostLoad1m": load1,
    "hostLoad5m": load5,
    "hostLoad15m": load15,
    "cpuCores": cores,
    "hostCpuPctEst": host_cpu,
    "hostMemPct": mem_pct,
    "hostMemUsedBytes": mem_used,
    "hostMemTotalBytes": mem_total,
    "hostDiskPct": disk_pct,
    "hostDiskUsedBytes": disk_used,
    "hostDiskTotalBytes": disk_total,
    "containers": containers,
    "swarmServiceCount": swarm_count,
    "collectorVersion": "v3-procstat",
}

payload = json.dumps(sample, separators=(",", ":"))
node = f"""
const fs = require('fs');
const p = '/app/data/vps-infra/cpu-samples.jsonl';
fs.mkdirSync('/app/data/vps-infra', {{ recursive: true }});
fs.appendFileSync(p, {json.dumps(payload)} + '\\n');
const lines = fs.readFileSync(p, 'utf8').trim().split('\\n').filter(Boolean);
if (lines.length > 10000) {{
  fs.writeFileSync(p, lines.slice(-10000).join('\\n') + '\\n');
}}
"""
subprocess.run(["docker", "exec", cid, "node", "-e", node], check=True)
print(f"[cpu-collector] ok cpu={host_cpu}% mem={mem_pct}% disk={disk_pct}% load={load1}")
PY
}

main "$@"

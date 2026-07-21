#!/usr/bin/env python3
"""Guardião transacional da configuração dinâmica Traefik/Easypanel.

Um único escritor para main.yaml:
- remove do main chaves de projetos que possuem YAML isolado válido;
- normaliza Host(`dominio/`) e entryPoints conhecidos;
- corrige backends apenas por allowlist explícita;
- valida, grava de forma atômica, faz probes e rollback em regressão.

Nunca reinicia, força ou envia HUP ao Traefik.
"""

import argparse
import copy
import hashlib
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Pattern, Tuple

try:
    import fcntl  # type: ignore
except ModuleNotFoundError:  # Permite testes locais no Windows; VPS usa Linux/fcntl.
    fcntl = None  # type: ignore


DEFAULT_HOME = Path(os.environ.get("GUARDIAN_HOME", "/root/waba-infra/guardiao-sistemas"))
REGISTRY_PATH = Path(
    os.environ.get("GUARDIAN_REGISTRY", str(DEFAULT_HOME / "registry.json"))
)
LOG_PATH = Path(
    os.environ.get("GUARDIAN_LOG", "/var/log/guardiao-sistemas-traefik.log")
)
STATE_PATH = Path(
    os.environ.get("GUARDIAN_STATE", "/var/lib/guardiao-sistemas-traefik/state.json")
)
LOCK_PATH = Path(
    os.environ.get("GUARDIAN_LOCK", "/var/run/guardiao-sistemas-traefik.lock")
)
BACKUP_DIR = Path(
    os.environ.get(
        "GUARDIAN_BACKUP_DIR",
        "/etc/easypanel/traefik/config/.guardiao-backups",
    )
)
LAST_GOOD = BACKUP_DIR / "main.last-good.json"
STOP = False


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def log(message: str, **fields: Any) -> None:
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {"ts": utc_now(), "message": message}
    payload.update(fields)
    line = json.dumps(payload, ensure_ascii=False, sort_keys=True)
    print(line, flush=True)
    with LOG_PATH.open("a", encoding="utf-8") as stream:
        stream.write(line + "\n")


def load_json(path: Path) -> Dict[str, Any]:
    raw = path.read_text(encoding="utf-8")
    value = json.loads(raw)
    if not isinstance(value, dict):
        raise ValueError(f"{path}: raiz deve ser objeto JSON")
    return value


def file_digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def config_maps(data: Dict[str, Any]) -> Tuple[Dict[str, Any], Dict[str, Any], Dict[str, Any]]:
    """Retorna routers, services, middlewares; suporta formato Traefik e flat Easypanel."""
    http = data.get("http")
    if isinstance(http, dict):
        routers = http.setdefault("routers", {})
        services = http.setdefault("services", {})
        middlewares = http.setdefault("middlewares", {})
        if not all(isinstance(item, dict) for item in (routers, services, middlewares)):
            raise ValueError("http.routers/services/middlewares devem ser objetos")
        return routers, services, middlewares

    routers: Dict[str, Any] = {}
    services: Dict[str, Any] = {}
    middlewares: Dict[str, Any] = {}
    for key, value in data.items():
        if not isinstance(value, dict):
            continue
        if "loadBalancer" in value:
            services[key] = value
        elif "rule" in value or "entryPoints" in value:
            routers[key] = value
        else:
            middlewares[key] = value
    return routers, services, middlewares


def all_config_keys(data: Dict[str, Any]) -> Iterable[str]:
    if isinstance(data.get("http"), dict):
        for mapping in config_maps(data):
            yield from mapping.keys()
        return
    yield from data.keys()


def compile_patterns(items: Iterable[str]) -> List[Pattern[str]]:
    return [re.compile(item) for item in items]


def remove_key(data: Dict[str, Any], key: str) -> bool:
    if isinstance(data.get("http"), dict):
        removed = False
        for mapping in config_maps(data):
            if key in mapping:
                del mapping[key]
                removed = True
        return removed
    return data.pop(key, None) is not None


HOST_WITH_SLASH = re.compile(r"Host\(\s*([`'\"])([^`'\"]+?)/+\1\s*\)")


def normalize_rule(rule: str) -> str:
    return HOST_WITH_SLASH.sub(lambda match: f"Host(`{match.group(2)}`)", rule)


def normalize_main(
    main_data: Dict[str, Any],
    registry: Dict[str, Any],
    config_dir: Path,
) -> Tuple[Dict[str, Any], List[str], List[str]]:
    candidate = copy.deepcopy(main_data)
    changes: List[str] = []
    warnings: List[str] = []

    isolated_patterns: List[Tuple[str, List[Pattern[str]]]] = []
    isolated_key_owners: Dict[str, str] = {}
    for project in registry.get("isolated_projects", []):
        project_id = str(project["id"])
        isolated_path = config_dir / str(project["file"])
        if not isolated_path.exists():
            warnings.append(f"{project_id}: YAML isolado ausente; strip bloqueado")
            continue
        try:
            isolated = load_json(isolated_path)
            config_maps(isolated)
        except Exception as exc:
            warnings.append(f"{project_id}: YAML isolado inválido; strip bloqueado: {exc}")
            continue
        patterns = compile_patterns(project.get("key_patterns", []))
        isolated_patterns.append((project_id, patterns))
        for key in all_config_keys(isolated):
            prior = isolated_key_owners.get(key)
            if prior and prior != project_id:
                raise ValueError(
                    f"chave duplicada entre YAMLs isolados: {key} ({prior}, {project_id})"
                )
            isolated_key_owners[key] = project_id

    for key in list(all_config_keys(candidate)):
        for project_id, patterns in isolated_patterns:
            if any(pattern.search(key) for pattern in patterns):
                if remove_key(candidate, key):
                    changes.append(f"strip main:{key} owner={project_id}")
                break

    routers, services, _ = config_maps(candidate)
    entrypoint_map = registry.get("entrypoint_map", {})
    for key, router in routers.items():
        if not isinstance(router, dict):
            continue
        points = router.get("entryPoints")
        if isinstance(points, list):
            normalized = [entrypoint_map.get(point, point) for point in points]
            if normalized != points:
                router["entryPoints"] = normalized
                changes.append(f"entryPoints {key}: {points} -> {normalized}")
        rule = router.get("rule")
        if isinstance(rule, str):
            normalized_rule = normalize_rule(rule)
            if normalized_rule != rule:
                router["rule"] = normalized_rule
                changes.append(f"Host sem barra {key}")

    managed = [
        (item["id"], re.compile(item["key_pattern"]), item["url"])
        for item in registry.get("managed_services", [])
    ]
    for key, service in services.items():
        if not isinstance(service, dict) or not isinstance(service.get("loadBalancer"), dict):
            continue
        for service_id, pattern, expected_url in managed:
            if not pattern.search(key):
                continue
            lb = service["loadBalancer"]
            servers = lb.get("servers")
            current = ""
            if isinstance(servers, list) and servers and isinstance(servers[0], dict):
                current = str(servers[0].get("url", ""))
            if current.rstrip("/") + "/" != expected_url.rstrip("/") + "/":
                lb["servers"] = [{"url": expected_url.rstrip("/") + "/"}]
                changes.append(f"backend {key}: {current or '<vazio>'} -> {expected_url}")
            if lb.get("passHostHeader") is not True:
                lb["passHostHeader"] = True
                changes.append(f"passHostHeader {key}: true")
            break

    remaining = list(all_config_keys(candidate))
    for project_id, patterns in isolated_patterns:
        leaked = [key for key in remaining if any(pattern.search(key) for pattern in patterns)]
        if leaked:
            raise ValueError(f"strip incompleto {project_id}: {', '.join(leaked)}")

    # Round-trip garante que o conteúdo final é JSON válido antes de tocar no arquivo real.
    json.loads(json.dumps(candidate, ensure_ascii=False))
    return candidate, changes, warnings


def probe_one(probe: Dict[str, Any]) -> str:
    command = [
        "curl",
        "-sk",
        "-o",
        "/dev/null",
        "-w",
        "%{http_code}",
        "--max-time",
        "12",
    ]
    host = probe.get("host")
    if host:
        command.extend(["--resolve", f"{host}:443:127.0.0.1"])
    command.append(str(probe["url"]))
    try:
        result = subprocess.run(
            command,
            check=False,
            capture_output=True,
            text=True,
            timeout=15,
        )
        code = result.stdout.strip()
        return code if re.fullmatch(r"\d{3}", code) else "000"
    except Exception:
        return "000"


def run_probes(registry: Dict[str, Any]) -> Dict[str, str]:
    return {
        str(probe["id"]): probe_one(probe)
        for probe in registry.get("probes", [])
    }


def acceptable_map(registry: Dict[str, Any]) -> Dict[str, List[str]]:
    return {
        str(probe["id"]): [str(code) for code in probe.get("acceptable", [200])]
        for probe in registry.get("probes", [])
    }


def regressions(
    before: Dict[str, str],
    after: Dict[str, str],
    acceptable: Dict[str, List[str]],
) -> List[str]:
    result = []
    for probe_id, prior_code in before.items():
        if prior_code in acceptable.get(probe_id, []) and after.get(probe_id) not in acceptable.get(probe_id, []):
            result.append(f"{probe_id}:{prior_code}->{after.get(probe_id, '000')}")
    return result


def write_state(**values: Any) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {"updated_at": utc_now()}
    payload.update(values)
    temporary = STATE_PATH.with_suffix(".tmp")
    temporary.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    os.replace(temporary, STATE_PATH)


def rotate_backups(keep: int) -> None:
    backups = sorted(
        BACKUP_DIR.glob("main.before-*.json"),
        key=lambda item: item.stat().st_mtime,
        reverse=True,
    )
    for old in backups[keep:]:
        old.unlink(missing_ok=True)


def atomic_write(path: Path, data: Dict[str, Any]) -> None:
    payload = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
    stat = path.stat()
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}.guardiao-",
        suffix=".tmp",
        dir=str(path.parent),
    )
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
            stream.write(payload)
            stream.flush()
            os.fsync(stream.fileno())
        os.chmod(temporary, stat.st_mode)
        try:
            os.chown(temporary, stat.st_uid, stat.st_gid)
        except PermissionError:
            pass
        load_json(temporary)
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def main_path(registry: Dict[str, Any]) -> Path:
    return Path(str(registry["config_dir"])) / str(registry["main_file"])


def locked() -> Any:
    LOCK_PATH.parent.mkdir(parents=True, exist_ok=True)
    stream = LOCK_PATH.open("w")
    if fcntl is not None:
        fcntl.flock(stream.fileno(), fcntl.LOCK_EX)
    return stream


def evaluate(mode: str) -> int:
    registry = load_json(REGISTRY_PATH)
    target = main_path(registry)
    if not target.exists():
        log("main ausente", path=str(target))
        write_state(mode=mode, status="error", error=f"main ausente: {target}")
        return 2

    lock_stream = locked()
    try:
        try:
            current = load_json(target)
            config_maps(current)
        except Exception as exc:
            log("main inválido; nenhuma escrita realizada", error=str(exc))
            write_state(mode=mode, status="invalid-main", error=str(exc))
            return 2

        try:
            candidate, changes, warnings = normalize_main(
                current,
                registry,
                Path(str(registry["config_dir"])),
            )
        except Exception as exc:
            log("candidate rejeitado", error=str(exc))
            write_state(mode=mode, status="candidate-error", error=str(exc))
            return 2

        before = run_probes(registry)
        for warning in warnings:
            log("aviso", detail=warning)
        if not changes:
            acceptable = acceptable_map(registry)
            all_good = all(
                before.get(probe_id) in codes
                for probe_id, codes in acceptable.items()
            )
            if all_good:
                BACKUP_DIR.mkdir(parents=True, exist_ok=True)
                shutil.copy2(target, LAST_GOOD)
            log("configuração limpa", mode=mode, probes=before)
            write_state(mode=mode, status="clean", probes=before, digest=file_digest(target))
            return 0

        log("drift detectado", mode=mode, changes=changes, probes_before=before)
        if mode == "audit":
            write_state(
                mode=mode,
                status="drift",
                changes=changes,
                warnings=warnings,
                probes=before,
                digest=file_digest(target),
            )
            return 1

        BACKUP_DIR.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
        baseline = BACKUP_DIR / f"main.before-{stamp}.json"
        shutil.copy2(target, baseline)
        atomic_write(target, candidate)
        wait_seconds = int(registry.get("file_watch_seconds", 8))
        log("candidate publicado; aguardando File provider", wait=wait_seconds)
        time.sleep(wait_seconds)
        after = run_probes(registry)
        bad = regressions(before, after, acceptable_map(registry))
        if bad:
            atomic_write(target, load_json(baseline))
            time.sleep(wait_seconds)
            rollback_probes = run_probes(registry)
            log(
                "rollback automático",
                regressions=bad,
                probes_after=after,
                probes_rollback=rollback_probes,
                backup=str(baseline),
            )
            write_state(
                mode=mode,
                status="rolled-back",
                changes=changes,
                regressions=bad,
                probes=rollback_probes,
                backup=str(baseline),
            )
            return 3

        acceptable = acceptable_map(registry)
        all_good = all(
            after.get(probe_id) in codes
            for probe_id, codes in acceptable.items()
        )
        if all_good:
            shutil.copy2(target, LAST_GOOD)
        rotate_backups(int(registry.get("backup_keep", 30)))
        log("reparo aplicado", changes=changes, probes_after=after, all_good=all_good)
        write_state(
            mode=mode,
            status="repaired",
            changes=changes,
            warnings=warnings,
            probes=after,
            all_good=all_good,
            backup=str(baseline),
            digest=file_digest(target),
        )
        return 0
    finally:
        if fcntl is not None:
            fcntl.flock(lock_stream.fileno(), fcntl.LOCK_UN)
        lock_stream.close()


def daemon(mode: str) -> int:
    registry = load_json(REGISTRY_PATH)
    target = main_path(registry)
    poll_seconds = max(1, int(registry.get("poll_seconds", 2)))
    stable_reads = max(1, int(registry.get("stable_reads", 2)))
    last_seen: Optional[str] = None
    pending: Optional[str] = None
    stable = 0
    log("daemon iniciado", mode=mode, target=str(target), poll_seconds=poll_seconds)

    while not STOP:
        try:
            digest = file_digest(target) if target.exists() else "missing"
            if digest != pending:
                pending = digest
                stable = 1
            else:
                stable += 1
            if digest != last_seen and stable >= stable_reads:
                evaluate(mode)
                last_seen = file_digest(target) if target.exists() else "missing"
                pending = last_seen
                stable = 0
        except Exception as exc:
            log("erro no daemon", error=str(exc))
        time.sleep(poll_seconds)
    log("daemon encerrado")
    return 0


def rollback_last_good() -> int:
    registry = load_json(REGISTRY_PATH)
    target = main_path(registry)
    if not LAST_GOOD.exists():
        log("last-good ausente", path=str(LAST_GOOD))
        return 2
    load_json(LAST_GOOD)
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    if target.exists():
        shutil.copy2(target, BACKUP_DIR / f"main.before-rollback-{stamp}.json")
    atomic_write(target, load_json(LAST_GOOD))
    wait_seconds = int(registry.get("file_watch_seconds", 8))
    time.sleep(wait_seconds)
    probes = run_probes(registry)
    log("last-good restaurado", probes=probes)
    write_state(mode="rollback", status="last-good-restored", probes=probes)
    return 0


def stop_handler(_signum: int, _frame: Any) -> None:
    global STOP
    STOP = True


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Guardião de Sistemas Traefik")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("audit")
    sub.add_parser("repair")
    sub.add_parser("rollback")
    daemon_parser = sub.add_parser("daemon")
    daemon_parser.add_argument("--mode", choices=("audit", "repair"), default="audit")
    return parser.parse_args()


def cli() -> int:
    signal.signal(signal.SIGTERM, stop_handler)
    signal.signal(signal.SIGINT, stop_handler)
    args = parse_args()
    if args.command == "audit":
        return evaluate("audit")
    if args.command == "repair":
        return evaluate("repair")
    if args.command == "rollback":
        return rollback_last_good()
    return daemon(args.mode)


if __name__ == "__main__":
    sys.exit(cli())

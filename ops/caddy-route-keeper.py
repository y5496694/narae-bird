#!/usr/bin/env python3
"""Keep the Pi Caddy runtime aligned with Aiedue's self-hosted Caddyfile."""

import json
import os
from pathlib import Path
import subprocess
import time
import urllib.request

ADMIN = os.environ.get("CADDY_ADMIN", "http://127.0.0.1:2019")
CONFIG = Path(os.environ.get("AIEDUE_CADDYFILE", "/home/aiedue/config/Caddyfile"))
ENV_FILE = Path(os.environ.get("AIEDUE_CADDY_ENV", "/home/aiedue/.config/aiedue/caddy.env"))
INTERVAL_SECONDS = max(5, int(os.environ.get("AIEDUE_CADDY_KEEPER_INTERVAL", "30")))


def read_env_file():
    env = dict(os.environ)
    if not ENV_FILE.is_file():
        return env
    for raw in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def desired_config():
    result = subprocess.run(
        ["/usr/bin/caddy", "adapt", "--config", str(CONFIG), "--adapter", "caddyfile"],
        env=read_env_file(), capture_output=True, text=True, check=False, timeout=20
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "caddy adapt failed")
    return json.loads(result.stdout)


def current_config():
    with urllib.request.urlopen(ADMIN + "/config/", timeout=5) as response:
        return json.load(response)


def canonical(value):
    # Caddy emits file_server.hide from a Go map in arbitrary order. It is a set,
    # unlike routes/handlers whose order must never be sorted.
    def normalize(item, key=None):
        if isinstance(item, dict):
            return {k: normalize(v, k) for k, v in item.items()}
        if isinstance(item, list):
            normalized = [normalize(v) for v in item]
            return sorted(normalized) if key == "hide" and all(isinstance(v, str) for v in normalized) else normalized
        return item
    return json.dumps(normalize(value), ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def load_config(config):
    body = json.dumps(config, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        ADMIN + "/load", data=body, method="POST", headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        return response.status


def reconcile():
    desired = desired_config()
    current = current_config()
    if canonical(current) == canonical(desired):
        return False
    status = load_config(desired)
    print(f"loaded Aiedue Caddy runtime config status={status}", flush=True)
    return True


if __name__ == "__main__":
    while True:
        try:
            reconcile()
        except Exception as error:
            print(f"Aiedue Caddy keeper waiting: {error}", flush=True)
        time.sleep(INTERVAL_SECONDS)

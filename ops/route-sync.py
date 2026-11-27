#!/usr/bin/env python3
"""One-shot Caddy reconciliation using the same canonical config/env as its keeper."""
import importlib.util
import fcntl
from pathlib import Path

with Path('/home/aiedue/config/domain-bird-route.lock').open('a') as lock:
    fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
    spec = importlib.util.spec_from_file_location('keeper', '/home/aiedue/bin/aiedue-caddy-route-keeper.py')
    keeper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(keeper)
    keeper.reconcile()

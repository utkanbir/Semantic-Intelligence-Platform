#!/usr/bin/env python3
"""Verify live FastAPI /api/v1 routes are documented in architecture contracts (S36-05).

Compares OpenAPI routes from the backend app against paths declared in
``docs/architecture/*_Contract_*.md``. Routes in ``contract_sync_baseline.json``
are grandfathered; any other undocumented route fails (blocks CI).

Usage:
  PYTHONPATH=backend python scripts/verify_contract_sync.py
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
BACKEND_ROOT = REPO_ROOT / "backend"
CONTRACT_DIR = REPO_ROOT / "docs" / "architecture"
BASELINE_PATH = Path(__file__).resolve().parent / "contract_sync_baseline.json"

TABLE_ROUTE_RE = re.compile(
    r"\|\s*`(GET|POST|PUT|PATCH|DELETE)`\s*\|\s*`(/api/v1[^`]+)`",
    re.IGNORECASE,
)
INLINE_API_ROUTE_RE = re.compile(
    r"\b(GET|POST|PUT|PATCH|DELETE)\s+(/api/v1\S+)",
    re.IGNORECASE,
)
INLINE_MODULE_ROUTE_RE = re.compile(
    r"\b(GET|POST|PUT|PATCH|DELETE)\s+(/(?:ontologies|adapters|connectors)[^\s`|]*)",
    re.IGNORECASE,
)


def normalize_path(path: str) -> str:
    """Normalize path params and optional query suffix for comparison."""
    cleaned = path.strip().strip("`").split("?")[0].strip().rstrip("/") or "/"
    cleaned = cleaned.rstrip("—-").strip()
    if not cleaned.startswith("/api/v1"):
        if cleaned.startswith("/"):
            cleaned = f"/api/v1{cleaned}"
        else:
            cleaned = f"/api/v1/{cleaned}"
    return re.sub(r"\{[^}]+\}", "{id}", cleaned)


def parse_contract_routes(contract_dir: Path = CONTRACT_DIR) -> set[tuple[str, str]]:
    routes: set[tuple[str, str]] = set()
    for path in sorted(contract_dir.glob("*_Contract_*.md")):
        text = path.read_text(encoding="utf-8")
        for pattern in (TABLE_ROUTE_RE, INLINE_API_ROUTE_RE, INLINE_MODULE_ROUTE_RE):
            for match in pattern.finditer(text):
                method = match.group(1).upper()
                route_path = normalize_path(match.group(2))
                routes.add((method, route_path))
    return routes


def load_baseline(path: Path = BASELINE_PATH) -> set[tuple[str, str]]:
    if not path.is_file():
        return set()
    payload = json.loads(path.read_text(encoding="utf-8"))
    routes: set[tuple[str, str]] = set()
    for item in payload.get("routes", []):
        method = str(item.get("method", "")).upper()
        route_path = normalize_path(str(item.get("path", "")))
        if method and route_path:
            routes.add((method, route_path))
    return routes


def collect_live_routes() -> set[tuple[str, str]]:
    if str(BACKEND_ROOT) not in sys.path:
        sys.path.insert(0, str(BACKEND_ROOT))

    from app.core.app import create_app  # noqa: PLC0415

    app = create_app()
    routes: set[tuple[str, str]] = set()
    for path, operations in app.openapi()["paths"].items():
        if not path.startswith("/api/v1"):
            continue
        for method, operation in operations.items():
            if method not in {"get", "post", "put", "patch", "delete"}:
                continue
            if isinstance(operation, dict) and operation.get("include_in_schema") is False:
                continue
            routes.add((method.upper(), normalize_path(path)))
    return routes


def verify_contract_sync(
    *,
    contract_dir: Path = CONTRACT_DIR,
    baseline_path: Path = BASELINE_PATH,
) -> list[str]:
    errors: list[str] = []
    live = collect_live_routes()
    documented = parse_contract_routes(contract_dir)
    baseline = load_baseline(baseline_path)
    allowed = documented | baseline

    undocumented = sorted(live - allowed)
    for method, path in undocumented:
        errors.append(f"Undocumented API route: {method} {path}")

    stale_baseline = sorted(baseline - live)
    for method, path in stale_baseline:
        errors.append(f"Stale contract-sync baseline entry (no live route): {method} {path}")

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify API routes match architecture contracts")
    parser.add_argument("--contract-dir", type=Path, default=CONTRACT_DIR)
    parser.add_argument("--baseline", type=Path, default=BASELINE_PATH)
    args = parser.parse_args()

    errors = verify_contract_sync(
        contract_dir=args.contract_dir,
        baseline_path=args.baseline,
    )
    if errors:
        print("Contract sync verification FAILED:", file=sys.stderr)
        for item in errors:
            print(f"  - {item}", file=sys.stderr)
        return 1

    print(
        f"OK: {len(collect_live_routes())} live /api/v1 routes are documented "
        f"or covered by contract-sync baseline."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())

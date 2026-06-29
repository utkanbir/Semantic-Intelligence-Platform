#!/usr/bin/env python3
"""Verify sip-dev cluster DB matches sprint-close expectations.

Run before closing a sprint milestone (after alembic upgrade on cluster):

  python scripts/verify_sprint_db.py --sprint 8

Exit 0 when alembic head and expected tables exist; exit 1 with actionable errors otherwise.

Update scripts/sprint_db_expectations.json when a sprint adds migrations.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

MANIFEST_PATH = Path(__file__).resolve().parent / "sprint_db_expectations.json"


def _run_psql(
    *,
    namespace: str,
    pod: str,
    db_user: str,
    database: str,
    sql: str,
) -> str:
    command = [
        "kubectl",
        "-n",
        namespace,
        "exec",
        pod,
        "--",
        "psql",
        "-U",
        db_user,
        "-d",
        database,
        "-tAc",
        sql,
    ]
    result = subprocess.run(command, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        stderr = result.stderr.strip() or result.stdout.strip()
        raise RuntimeError(f"kubectl/psql failed: {stderr}")
    return result.stdout.strip()


def _load_manifest() -> dict:
    with MANIFEST_PATH.open(encoding="utf-8") as handle:
        return json.load(handle)


def verify_sprint(
    sprint: str,
    *,
    namespace: str | None = None,
    pod: str | None = None,
    database: str | None = None,
    db_user: str | None = None,
) -> list[str]:
    manifest = _load_manifest()
    sprint_key = str(sprint)
    expectations = manifest.get("sprints", {}).get(sprint_key)
    if expectations is None:
        raise KeyError(f"No DB expectations for sprint {sprint_key} in {MANIFEST_PATH.name}")

    namespace = namespace or manifest.get("default_namespace", "sip-dev")
    pod = pod or manifest.get("default_postgres_pod", "sip-postgres-0")
    database = database or manifest.get("default_database", "sip_db")
    db_user = db_user or manifest.get("default_db_user", "sip_user")

    errors: list[str] = []
    label = expectations.get("label", sprint_key)
    expected_head = expectations["alembic_head"]
    new_tables = expectations.get("new_tables", [])
    cumulative_tables = expectations.get("cumulative_tables", [])

    print(f"Verifying Sprint {sprint_key} ({label}) on {namespace}/{pod} ...")

    try:
        actual_head = _run_psql(
            namespace=namespace,
            pod=pod,
            db_user=db_user,
            database=database,
            sql="SELECT version_num FROM alembic_version",
        )
    except RuntimeError as error:
        errors.append(str(error))
        return errors

    if actual_head != expected_head:
        errors.append(
            f"Alembic head mismatch: cluster={actual_head!r}, expected={expected_head!r}. "
            f"Run: kubectl -n {namespace} port-forward svc/sip-postgres 5433:5432 "
            f"then from backend/: python -m alembic upgrade head"
        )

    tables_raw = _run_psql(
        namespace=namespace,
        pod=pod,
        db_user=db_user,
        database=database,
        sql="SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
    )
    actual_tables = {line.strip() for line in tables_raw.splitlines() if line.strip()}

    missing_new = sorted(table for table in new_tables if table not in actual_tables)
    if missing_new:
        errors.append(
            "Sprint new tables missing in cluster DB: "
            + ", ".join(missing_new)
            + ". This is a sprint-close blocker — apply migrations before retro/milestone close."
        )

    missing_cumulative = sorted(
        table for table in cumulative_tables if table not in actual_tables
    )
    if missing_cumulative:
        errors.append(
            "Cumulative schema tables missing in cluster DB: "
            + ", ".join(missing_cumulative)
        )

    extra_tables = sorted(actual_tables - set(cumulative_tables))
    if cumulative_tables and extra_tables:
        print(f"Note: extra tables in cluster (not in manifest): {', '.join(extra_tables)}")

    if not errors:
        print(f"OK: alembic_head={actual_head}")
        if new_tables:
            print(f"OK: sprint new tables present: {', '.join(new_tables)}")
        print(f"OK: {len(cumulative_tables)} cumulative tables verified")

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify cluster DB for sprint close")
    parser.add_argument(
        "--sprint",
        required=True,
        help="Sprint number (must exist in sprint_db_expectations.json)",
    )
    parser.add_argument("--namespace", default=None)
    parser.add_argument("--postgres-pod", default=None)
    parser.add_argument("--database", default=None)
    parser.add_argument("--db-user", default=None)
    args = parser.parse_args()

    try:
        errors = verify_sprint(
            args.sprint,
            namespace=args.namespace,
            pod=args.postgres_pod,
            database=args.database,
            db_user=args.db_user,
        )
    except KeyError as error:
        print(str(error), file=sys.stderr)
        return 1
    except RuntimeError as error:
        print(str(error), file=sys.stderr)
        return 1

    if errors:
        print("Sprint DB verification FAILED:", file=sys.stderr)
        for item in errors:
            print(f"  - {item}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())

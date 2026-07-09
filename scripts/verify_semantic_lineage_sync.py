#!/usr/bin/env python3
"""Verify SEMANTIC_LINEAGE_TRANSACTION_TYPES matches taxonomy contract §6.1 (S37-04).

Usage:
  PYTHONPATH=backend python scripts/verify_semantic_lineage_sync.py
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
BACKEND_ROOT = REPO_ROOT / "backend"
TAXONOMY_CONTRACT = (
    REPO_ROOT / "docs" / "governance" / "SIP_Semantic_Transaction_Taxonomy_and_Eligibility_Contract.md"
)

SECTION_61_HEADING = re.compile(r"(?i)^###\s+6\.1\s+semantic lineage")
TRANSACTION_TYPE = re.compile(r"`(ontology\.[^`]+)`")


def parse_contract_semantic_lineage_types(path: Path = TAXONOMY_CONTRACT) -> set[str]:
    if not path.is_file():
        raise FileNotFoundError(f"Taxonomy contract missing: {path}")

    lines = path.read_text(encoding="utf-8").splitlines()
    start = next(
        (idx for idx, line in enumerate(lines) if SECTION_61_HEADING.match(line.strip())),
        None,
    )
    if start is None:
        raise ValueError("Taxonomy contract §6.1 heading not found")

    types: set[str] = set()
    for line in lines[start + 1 :]:
        if line.startswith("### "):
            break
        for match in TRANSACTION_TYPE.finditer(line):
            types.add(match.group(1))
    return types


def verify_semantic_lineage_sync(
    *,
    repo_root: Path = REPO_ROOT,
    taxonomy_contract: Path | None = None,
) -> list[str]:
    errors: list[str] = []
    contract_path = taxonomy_contract or (
        repo_root / "docs" / "governance" / "SIP_Semantic_Transaction_Taxonomy_and_Eligibility_Contract.md"
    )
    backend_root = repo_root / "backend"

    contract_types = parse_contract_semantic_lineage_types(contract_path)
    if str(backend_root) not in sys.path:
        sys.path.insert(0, str(backend_root))
    from app.modules.audit_trace.domain.trace_audience import (  # noqa: PLC0415
        SEMANTIC_LINEAGE_TRANSACTION_TYPES,
    )

    code_types = set(SEMANTIC_LINEAGE_TRANSACTION_TYPES)

    missing_in_contract = sorted(code_types - contract_types)
    missing_in_code = sorted(contract_types - code_types)

    if missing_in_contract:
        errors.append(
            "Code emits semantic_lineage types missing from taxonomy §6.1: "
            + ", ".join(missing_in_contract)
        )
    if missing_in_code:
        errors.append(
            "Taxonomy §6.1 lists types not in SEMANTIC_LINEAGE_TRANSACTION_TYPES: "
            + ", ".join(missing_in_code)
        )
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify semantic lineage taxonomy parity")
    parser.add_argument("--repo-root", type=Path, default=REPO_ROOT)
    args = parser.parse_args()

    errors = verify_semantic_lineage_sync(repo_root=args.repo_root)
    if errors:
        print("Semantic lineage sync FAILED:", file=sys.stderr)
        for item in errors:
            print(f"  - {item}", file=sys.stderr)
        return 1

    print("OK: semantic lineage types match taxonomy §6.1 and code.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

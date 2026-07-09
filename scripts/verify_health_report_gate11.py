#!/usr/bin/env python3
"""Verify health-report gate-trigger-11 checklist hygiene (S36-03).

From Sprint 36 onward, each sprint health report must include §9-style
gate-trigger-11-class checklist. A **Green** summary is invalid when any
applicable checklist row is **Fail** or unset.

Usage:
  python scripts/verify_health_report_gate11.py --sprint 36
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
HEALTH_GLOB = "Sprint_{sprint}_*_health.md"
ENFORCE_FROM_SPRINT = 36

SECTION_HEADING = re.compile(
    r"(?i)^##\s+.*gate\s+trigger\s+#?11",
)
SUMMARY_GREEN = re.compile(r"(?i)\*\*green\*\*|\bgreen\b")
TABLE_ROW = re.compile(r"^\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|")
RESULT_CELL = re.compile(r"^\s*(pass|fail|n/?a)\s*$", re.IGNORECASE)


def _health_paths(repo_root: Path, sprint: int) -> list[Path]:
    health_dir = repo_root / "docs" / "governance" / "health-reports"
    if not health_dir.is_dir():
        return []
    return sorted(health_dir.glob(HEALTH_GLOB.format(sprint=sprint)))


def _extract_section(lines: list[str], heading_idx: int) -> list[str]:
    section: list[str] = []
    for line in lines[heading_idx + 1 :]:
        if line.startswith("## "):
            break
        section.append(line)
    return section


def _parse_checklist_table(section_lines: list[str]) -> list[tuple[str, str]]:
    """Return (check_id, result) for data rows in the gate-11 table."""
    rows: list[tuple[str, str]] = []
    in_table = False
    for line in section_lines:
        if not line.strip().startswith("|"):
            if in_table:
                break
            continue
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if len(cells) < 4:
            continue
        if cells[0].lower() in {"id", "---", "----"} or set(cells[0]) <= {"-"}:
            in_table = True
            continue
        in_table = True
        check_id = cells[0]
        result = cells[2]
        rows.append((check_id, result))
    return rows


def _summary_is_green(text: str) -> bool:
    in_summary = False
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.lower().startswith("## 1."):
            in_summary = True
            continue
        if in_summary and stripped.startswith("## "):
            break
        if in_summary and SUMMARY_GREEN.search(line):
            return True
    return False


def verify_health_report_gate11(
    sprint: int,
    *,
    repo_root: Path = REPO_ROOT,
    enforce_from: int = ENFORCE_FROM_SPRINT,
) -> list[str]:
    if sprint < enforce_from:
        return []

    errors: list[str] = []
    paths = _health_paths(repo_root, sprint)
    if not paths:
        return [
            f"Sprint {sprint}: no health report found for gate-trigger-11 verification "
            f"(required from Sprint {enforce_from})"
        ]

    for path in paths:
        content = path.read_text(encoding="utf-8")
        lines = content.splitlines()
        heading_idx = next(
            (idx for idx, line in enumerate(lines) if SECTION_HEADING.match(line.strip())),
            None,
        )
        rel = path.relative_to(repo_root)
        if heading_idx is None:
            errors.append(
                f"{rel}: missing 'Gate trigger #11' checklist section "
                f"(required from Sprint {enforce_from})"
            )
            continue

        section = _extract_section(lines, heading_idx)
        rows = _parse_checklist_table(section)
        if not rows:
            errors.append(f"{rel}: gate-trigger-11 checklist table is empty or malformed")
            continue

        fails: list[str] = []
        unset: list[str] = []
        for check_id, result in rows:
            if not result:
                unset.append(check_id)
                continue
            if RESULT_CELL.match(result):
                if result.strip().lower() == "fail":
                    fails.append(check_id)
            else:
                unset.append(check_id)

        if fails:
            errors.append(
                f"{rel}: gate-trigger-11 checklist has Fail result(s): {', '.join(fails)}"
            )
        if unset:
            errors.append(
                f"{rel}: gate-trigger-11 checklist missing Pass/Fail/N/A for: {', '.join(unset)}"
            )

        if _summary_is_green(content) and (fails or unset):
            errors.append(
                f"{rel}: summary rated Green but gate-trigger-11 checklist is not all Pass/N/A"
            )

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Verify health-report gate-trigger-11 checklist at sprint close",
    )
    parser.add_argument("--sprint", type=int, required=True)
    parser.add_argument("--repo-root", type=Path, default=REPO_ROOT)
    parser.add_argument(
        "--enforce-from",
        type=int,
        default=ENFORCE_FROM_SPRINT,
        help=f"First sprint requiring checklist (default {ENFORCE_FROM_SPRINT})",
    )
    args = parser.parse_args()

    errors = verify_health_report_gate11(
        args.sprint,
        repo_root=args.repo_root,
        enforce_from=args.enforce_from,
    )

    if errors:
        print(f"Sprint {args.sprint} gate-trigger-11 verification FAILED:", file=sys.stderr)
        for item in errors:
            print(f"  - {item}", file=sys.stderr)
        return 1

    if args.sprint < args.enforce_from:
        print(
            f"SKIP: Sprint {args.sprint} predates gate-trigger-11 enforcement "
            f"(from Sprint {args.enforce_from})."
        )
    else:
        print(f"OK: Sprint {args.sprint} health-report gate-trigger-11 checklist passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

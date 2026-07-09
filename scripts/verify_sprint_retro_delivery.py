#!/usr/bin/env python3
"""Verify retro delivery rate against kickoff sprint plan (S36-07).

From Sprint 37 onward, each sprint retro must:
  1. Link the kickoff plan doc frozen at sprint start.
  2. Report delivery rate as delivered/committed implementation issues from that plan.
  3. Not re-scope the denominator at close (dropped issues still count as not delivered).

Usage:
  python scripts/verify_sprint_retro_delivery.py --sprint 37
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
PLAN_GLOB = "Sprint_{sprint}_*_Plan.md"
RETRO_GLOB = "Sprint_{sprint}_*_retro.md"
ENFORCE_FROM_SPRINT = 37

KICKOFF_PLAN_LINE = re.compile(
    r"(?i)\*\*kickoff plan:\*\*\s*`?([^`\n]+)`?",
)
DELIVERY_RATE = re.compile(
    r"(?i)\*\*delivery rate:\*\*\s*(\d+)\s*/\s*(\d+)",
)
ISSUE_NUMBER = re.compile(r"#(\d+)")
EPIC_ROW = re.compile(r"(?i)\bepic\b")


def _plan_paths(repo_root: Path, sprint: int) -> list[Path]:
    plan_dir = repo_root / "docs" / "project"
    return sorted(plan_dir.glob(PLAN_GLOB.format(sprint=sprint)))


def _retro_paths(repo_root: Path, sprint: int) -> list[Path]:
    retro_dir = repo_root / "docs" / "governance" / "retros"
    return sorted(retro_dir.glob(RETRO_GLOB.format(sprint=sprint)))


def _parse_plan_committed_issues(plan_text: str) -> set[int]:
    """Collect GitHub issue numbers from the committed scope table."""
    issues: set[int] = set()
    in_scope = False
    for line in plan_text.splitlines():
        if re.match(r"(?i)^##\s+3\.\s+committed scope", line.strip()):
            in_scope = True
            continue
        if in_scope and line.startswith("## "):
            break
        if not in_scope or not line.strip().startswith("|"):
            continue
        if "---" in line or line.lower().startswith("| id |"):
            continue
        if EPIC_ROW.search(line):
            continue
        for match in ISSUE_NUMBER.finditer(line):
            issues.add(int(match.group(1)))
    return issues


def _parse_retro_delivered_issues(retro_text: str) -> set[int]:
    """Collect issue numbers marked Done in section 1 table."""
    issues: set[int] = set()
    in_section = False
    for line in retro_text.splitlines():
        if re.match(r"(?i)^##\s+1\.\s+committed vs delivered", line.strip()):
            in_section = True
            continue
        if in_section and line.startswith("## "):
            break
        if not in_section or not line.strip().startswith("|"):
            continue
        if "---" in line or "issue" in line.lower() and "title" in line.lower():
            continue
        if EPIC_ROW.search(line) and "done" not in line.lower():
            continue
        if "done" not in line.lower():
            continue
        for match in ISSUE_NUMBER.finditer(line):
            issues.add(int(match.group(1)))
    return issues


def verify_sprint_retro_delivery(
    sprint: int,
    *,
    repo_root: Path = REPO_ROOT,
    enforce_from: int = ENFORCE_FROM_SPRINT,
) -> list[str]:
    if sprint < enforce_from:
        return []

    errors: list[str] = []
    plans = _plan_paths(repo_root, sprint)
    retros = _retro_paths(repo_root, sprint)
    if not plans:
        errors.append(f"Sprint {sprint}: no kickoff plan doc found ({PLAN_GLOB.format(sprint=sprint)})")
    if not retros:
        errors.append(f"Sprint {sprint}: no retro doc found for delivery verification")
    if errors:
        return errors

    plan_path = plans[0]
    plan_issues = _parse_plan_committed_issues(plan_path.read_text(encoding="utf-8"))
    if not plan_issues:
        errors.append(f"{plan_path.relative_to(repo_root)}: no committed implementation issues parsed")

    for retro_path in retros:
        retro_text = retro_path.read_text(encoding="utf-8")
        rel = retro_path.relative_to(repo_root)

        plan_link = KICKOFF_PLAN_LINE.search(retro_text)
        if not plan_link:
            errors.append(f"{rel}: missing **Kickoff plan:** link to sprint plan doc")
        else:
            linked = plan_link.group(1).strip()
            if plan_path.name not in linked.replace("\\", "/"):
                errors.append(
                    f"{rel}: kickoff plan link {linked!r} does not match {plan_path.name!r}"
                )

        rate_match = DELIVERY_RATE.search(retro_text)
        if not rate_match:
            errors.append(f"{rel}: missing **Delivery rate:** X/Y line")
            continue

        delivered_count = int(rate_match.group(1))
        committed_count = int(rate_match.group(2))
        if plan_issues and committed_count != len(plan_issues):
            errors.append(
                f"{rel}: delivery rate denominator {committed_count} != "
                f"kickoff plan committed issues {len(plan_issues)} "
                f"({sorted(plan_issues)})"
            )

        retro_delivered = _parse_retro_delivered_issues(retro_text)
        if plan_issues:
            missing_from_retro = plan_issues - retro_delivered
            if missing_from_retro:
                errors.append(
                    f"{rel}: kickoff plan issues missing from §1 table: "
                    f"{sorted(missing_from_retro)}"
                )
        if retro_delivered and delivered_count != len(retro_delivered):
            errors.append(
                f"{rel}: delivery rate numerator {delivered_count} != "
                f"§1 Done rows {len(retro_delivered)} ({sorted(retro_delivered)})"
            )

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify retro delivery rate vs kickoff plan")
    parser.add_argument("--sprint", type=int, required=True)
    parser.add_argument("--repo-root", type=Path, default=REPO_ROOT)
    parser.add_argument("--enforce-from", type=int, default=ENFORCE_FROM_SPRINT)
    args = parser.parse_args()

    errors = verify_sprint_retro_delivery(
        args.sprint,
        repo_root=args.repo_root,
        enforce_from=args.enforce_from,
    )

    if errors:
        print(f"Sprint {args.sprint} retro delivery verification FAILED:", file=sys.stderr)
        for item in errors:
            print(f"  - {item}", file=sys.stderr)
        return 1

    if args.sprint < args.enforce_from:
        print(
            f"SKIP: Sprint {args.sprint} predates kickoff-plan delivery enforcement "
            f"(from Sprint {args.enforce_from})."
        )
    else:
        print(f"OK: Sprint {args.sprint} retro delivery rate matches kickoff plan.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

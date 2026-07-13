#!/usr/bin/env python3
"""Verify retro delivery rate against kickoff sprint plan (S36-07, S37-02).

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
ISSUE_CELL = re.compile(r"^#(\d+)\b")
DELIVERED_DONE = re.compile(r"^done$", re.IGNORECASE)
EPIC_ROW = re.compile(r"(?i)\bepic\b|\bE-\d+\b")


def _split_table_row(line: str) -> list[str]:
    return [cell.strip() for cell in line.strip().strip("|").split("|")]


def _plan_paths(repo_root: Path, sprint: int) -> list[Path]:
    plan_dir = repo_root / "docs" / "project"
    return sorted(plan_dir.glob(PLAN_GLOB.format(sprint=sprint)))


def _retro_paths(repo_root: Path, sprint: int) -> list[Path]:
    retro_dir = repo_root / "docs" / "governance" / "retros"
    return sorted(retro_dir.glob(RETRO_GLOB.format(sprint=sprint)))


def _parse_plan_committed_issues(plan_text: str) -> set[int]:
    """Collect GitHub issue numbers from the plan §3 Issue column only."""
    issues: set[int] = set()
    in_scope = False
    issue_col_idx: int | None = None
    for line in plan_text.splitlines():
        if re.match(r"(?i)^##\s+3\.\s+committed scope", line.strip()):
            in_scope = True
            continue
        if in_scope and line.startswith("## "):
            break
        if not in_scope or not line.strip().startswith("|"):
            continue
        cells = _split_table_row(line)
        if not cells:
            continue
        if cells[0].lower() in {"id", "---"} or set(cells[0]) <= {"-"}:
            if cells[0].lower() == "id":
                issue_col_idx = next(
                    (idx for idx, header in enumerate(cells) if header.lower() == "issue"),
                    len(cells) - 1,
                )
            continue
        if issue_col_idx is None or len(cells) <= issue_col_idx:
            continue
        if EPIC_ROW.search(cells[0]):
            continue
        match = ISSUE_CELL.search(cells[issue_col_idx])
        if match:
            issues.add(int(match.group(1)))
    return issues


def _parse_retro_section1(retro_text: str) -> tuple[set[int], set[int]]:
    """Return (issues listed in §1, issues marked Done in §1)."""
    listed: set[int] = set()
    done: set[int] = set()
    in_section = False
    issue_col_idx: int | None = None
    delivered_col_idx: int | None = None

    for line in retro_text.splitlines():
        if re.match(r"(?i)^##\s+1\.\s+committed vs delivered", line.strip()):
            in_section = True
            continue
        if in_section and line.startswith("## "):
            break
        if not in_section or not line.strip().startswith("|"):
            continue
        cells = _split_table_row(line)
        if not cells:
            continue
        if cells[0].lower() in {"issue", "---"} or set(cells[0]) <= {"-"}:
            if cells[0].lower() == "issue":
                issue_col_idx = 0
                delivered_col_idx = next(
                    (
                        idx
                        for idx, header in enumerate(cells)
                        if header.lower().startswith("delivered")
                    ),
                    None,
                )
            continue
        if issue_col_idx is None or delivered_col_idx is None:
            continue
        if len(cells) <= max(issue_col_idx, delivered_col_idx):
            continue
        row_text = " | ".join(cells)
        if EPIC_ROW.search(row_text):
            continue
        issue_match = ISSUE_CELL.match(cells[issue_col_idx])
        if not issue_match:
            continue
        issue_number = int(issue_match.group(1))
        listed.add(issue_number)
        if DELIVERED_DONE.match(cells[delivered_col_idx]):
            done.add(issue_number)
    return listed, done


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
        listed_issues, done_issues = _parse_retro_section1(retro_text)

        if plan_issues and committed_count != len(plan_issues):
            errors.append(
                f"{rel}: delivery rate denominator {committed_count} != "
                f"kickoff plan committed issues {len(plan_issues)} "
                f"({sorted(plan_issues)})"
            )

        if plan_issues:
            missing_from_table = plan_issues - listed_issues
            if missing_from_table:
                errors.append(
                    f"{rel}: kickoff plan issues missing from §1 table: "
                    f"{sorted(missing_from_table)}"
                )
            extra_done = done_issues - plan_issues
            if extra_done:
                errors.append(
                    f"{rel}: §1 Done rows include issues outside kickoff plan: "
                    f"{sorted(extra_done)}"
                )

        if done_issues and delivered_count != len(done_issues):
            errors.append(
                f"{rel}: delivery rate numerator {delivered_count} != "
                f"§1 Done rows {len(done_issues)} ({sorted(done_issues)})"
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

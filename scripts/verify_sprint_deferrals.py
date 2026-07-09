#!/usr/bin/env python3
"""Verify deferred-items ledger and sprint-close deferral hygiene (S36-02).

At sprint close:
  1. Every open ledger entry must have github_issue and target_milestone.
  2. When GH_TOKEN is set, each linked issue must exist and carry a milestone.
  3. Sprint retro + health-report files are scanned for deferral language; each
     matching line must reference #NNN or a ledger id with a linked issue.

Usage:
  python scripts/verify_sprint_deferrals.py --sprint 36
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPTS_DIR.parent
LEDGER_PATH = SCRIPTS_DIR / "deferred_items_ledger.json"

RETRO_GLOB = "Sprint_{sprint}_*_retro.md"
HEALTH_GLOB = "Sprint_{sprint}_*_health.md"

DEFERRAL_LINE = re.compile(
    r"(?i)"
    r"(\bdeferred?\b|\bcarried forward\b|\bnext sprint\b|\btarget sprint\b|"
    r"out of scope for this sprint|defer to sprint|deferred to sprint)"
)

EXCLUDE_LINE = re.compile(
    r"(?i)"
    r"(no longer deferred|not deferred|shipped since original deferral|"
    r"formerly deferral|deferred section|deferred items ledger|"
    r"verify_sprint_deferrals)"
)

ISSUE_REF = re.compile(r"#(\d+)\b")
LEDGER_ID = re.compile(r"\b(TD-\d+(?:-ADR)?)\b", re.IGNORECASE)


def _load_ledger(path: Path = LEDGER_PATH) -> dict:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def _ledger_index(ledger: dict) -> dict[str, dict]:
    index: dict[str, dict] = {}
    for item in ledger.get("items", []):
        item_id = str(item.get("id", "")).upper()
        if item_id:
            index[item_id] = item
        for alias in item.get("aliases", []):
            index[str(alias).upper()] = item
        # TD-006 alias for TD-006-ADR
        if item_id.startswith("TD-") and "-ADR" in item_id:
            base = item_id.replace("-ADR", "")
            index[base] = item
    return index


def validate_ledger_structure(ledger: dict) -> list[str]:
    errors: list[str] = []
    items = ledger.get("items")
    if not isinstance(items, list) or not items:
        return ["deferred_items_ledger.json has no items array"]
    for item in items:
        item_id = item.get("id")
        if not item_id:
            errors.append("Ledger item missing id")
            continue
        if item.get("status", "open") != "open":
            continue
        if not item.get("github_issue"):
            errors.append(f"Ledger {item_id}: missing github_issue")
        if not item.get("target_milestone"):
            errors.append(f"Ledger {item_id}: missing target_milestone")
    return errors


def _run_gh(args: list[str]) -> str:
    result = subprocess.run(
        ["gh", *args],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip() or "gh failed")
    return result.stdout


def validate_ledger_issues_github(ledger: dict, *, gh_token: str | None) -> list[str]:
    if not gh_token:
        print("SKIP: GitHub milestone verification for ledger issues (no GH_TOKEN).")
        return []

    errors: list[str] = []
    for item in ledger.get("items", []):
        if item.get("status", "open") != "open":
            continue
        issue_number = item.get("github_issue")
        if not issue_number:
            continue
        expected_milestone = item.get("target_milestone")
        try:
            payload = json.loads(
                _run_gh(
                    [
                        "issue",
                        "view",
                        str(issue_number),
                        "--json",
                        "number,milestone,state",
                    ]
                )
            )
        except RuntimeError as error:
            errors.append(f"Ledger {item['id']}: cannot load issue #{issue_number}: {error}")
            continue
        if payload.get("state") != "OPEN":
            errors.append(f"Ledger {item['id']}: issue #{issue_number} is not open")
        milestone = payload.get("milestone") or {}
        title = milestone.get("title")
        if not title:
            errors.append(f"Ledger {item['id']}: issue #{issue_number} has no milestone")
        elif expected_milestone and title != expected_milestone:
            errors.append(
                f"Ledger {item['id']}: issue #{issue_number} milestone is {title!r}, "
                f"expected {expected_milestone!r}"
            )
    return errors


def _sprint_doc_paths(repo_root: Path, sprint: int) -> list[Path]:
    retro_dir = repo_root / "docs" / "governance" / "retros"
    health_dir = repo_root / "docs" / "governance" / "health-reports"
    paths: list[Path] = []
    if retro_dir.is_dir():
        paths.extend(sorted(retro_dir.glob(RETRO_GLOB.format(sprint=sprint))))
    if health_dir.is_dir():
        paths.extend(sorted(health_dir.glob(HEALTH_GLOB.format(sprint=sprint))))
    return paths


def _line_has_ledger_coverage(line: str, ledger_index: dict[str, dict]) -> bool:
    if ISSUE_REF.search(line):
        return True
    for token in LEDGER_ID.findall(line):
        key = token.upper()
        if key in ledger_index and ledger_index[key].get("github_issue"):
            return True
    upper = line.upper()
    for key, entry in ledger_index.items():
        if entry.get("status", "open") != "open":
            continue
        if not entry.get("github_issue"):
            continue
        if key in upper and len(key) >= 4:
            return True
    return False


def scan_sprint_documents(
    repo_root: Path,
    sprint: int,
    ledger_index: dict[str, dict],
) -> list[str]:
    errors: list[str] = []
    paths = _sprint_doc_paths(repo_root, sprint)
    if not paths:
        return [
            f"Sprint {sprint}: no retro/health documents found for deferral scan "
            f"(cannot validate deferral hygiene)"
        ]

    for path in paths:
        in_code_fence = False
        for lineno, raw_line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
            line = raw_line.strip()
            if line.startswith("```"):
                in_code_fence = not in_code_fence
                continue
            if in_code_fence or not line or line.startswith("#"):
                continue
            if not DEFERRAL_LINE.search(line):
                continue
            if EXCLUDE_LINE.search(line):
                continue
            if _line_has_ledger_coverage(line, ledger_index):
                continue
            rel = path.relative_to(repo_root)
            errors.append(
                f"{rel}:{lineno}: deferral without linked issue or ledger id — {line[:120]}"
            )
    return errors


def verify_sprint_deferrals(
    sprint: int,
    *,
    repo_root: Path = REPO_ROOT,
    ledger_path: Path = LEDGER_PATH,
    gh_token: str | None = None,
    skip_github: bool = False,
) -> list[str]:
    errors: list[str] = []
    if not ledger_path.is_file():
        return [f"Ledger missing: {ledger_path}"]

    ledger = _load_ledger(ledger_path)
    errors.extend(validate_ledger_structure(ledger))
    if not skip_github:
        gh_errors = validate_ledger_issues_github(ledger, gh_token=gh_token)
        errors.extend(gh_errors)

    ledger_index = _ledger_index(ledger)
    errors.extend(scan_sprint_documents(repo_root, sprint, ledger_index))
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify deferred-items ledger at sprint close")
    parser.add_argument("--sprint", type=int, required=True)
    parser.add_argument("--repo-root", type=Path, default=REPO_ROOT)
    parser.add_argument("--ledger", type=Path, default=LEDGER_PATH)
    parser.add_argument(
        "--skip-github",
        action="store_true",
        help="Skip gh issue/milestone checks (unit tests)",
    )
    args = parser.parse_args()

    import os

    gh_token = None if args.skip_github else (os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN"))
    errors = verify_sprint_deferrals(
        args.sprint,
        repo_root=args.repo_root,
        ledger_path=args.ledger,
        gh_token=gh_token,
        skip_github=args.skip_github,
    )

    if errors:
        print(f"Sprint {args.sprint} deferral verification FAILED:", file=sys.stderr)
        for item in errors:
            print(f"  - {item}", file=sys.stderr)
        return 1

    print(f"OK: Sprint {args.sprint} deferral ledger and document hygiene passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Reconcile closed GitHub sprint milestones against develop close artifacts (S37-01).

For each closed milestone titled ``Sprint N — …`` where N >= enforce_from_sprint and N is
not in waived_sprints:

  1. ``develop`` must contain a commit whose subject starts with ``end_of_sprint_N:``
  2. Matching retro and health-report markdown files must exist

Usage:
  python scripts/verify_sprint_milestone_reconcile.py
  python scripts/verify_sprint_milestone_reconcile.py --sprint 37
  python scripts/verify_sprint_milestone_reconcile.py --skip-github
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = Path(__file__).resolve().parent
CONFIG_PATH = SCRIPTS_DIR / "sprint_milestone_reconcile.json"

END_OF_SPRINT_RE = re.compile(r"^end_of_sprint_(\d+):", re.IGNORECASE)


def _load_json(path: Path) -> dict:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def _load_config() -> dict:
    if not CONFIG_PATH.is_file():
        raise FileNotFoundError(f"Missing reconcile config: {CONFIG_PATH}")
    return _load_json(CONFIG_PATH)


def parse_sprint_from_milestone_title(title: str, pattern: str) -> int | None:
    match = re.match(pattern, title.strip(), re.IGNORECASE)
    if match is None:
        return None
    return int(match.group(1))


def find_sprint_documents(repo_root: Path, sprint: int, *, kind: str) -> list[Path]:
    if kind == "retro":
        pattern = f"Sprint_{sprint}_*_retro.md"
        base = repo_root / "docs" / "governance" / "retros"
    elif kind == "health":
        pattern = f"Sprint_{sprint}_*_health.md"
        base = repo_root / "docs" / "governance" / "health-reports"
    else:
        raise ValueError(f"Unknown document kind: {kind!r}")

    if not base.is_dir():
        return []
    return sorted(base.glob(pattern))


def sprint_has_end_of_sprint_commit(
    sprint: int,
    *,
    branch: str,
    repo_root: Path,
) -> bool:
    result = subprocess.run(
        ["git", "log", branch, "--format=%s"],
        capture_output=True,
        text=True,
        check=False,
        cwd=repo_root,
    )
    if result.returncode != 0:
        return False
    for subject in result.stdout.splitlines():
        match = END_OF_SPRINT_RE.match(subject.strip())
        if match is not None and int(match.group(1)) == sprint:
            return True
    return False


def verify_sprint_artifacts(
    sprint: int,
    *,
    repo_root: Path,
    branch: str,
) -> list[str]:
    """Return error messages for one sprint's close artifacts."""
    errors: list[str] = []
    if not sprint_has_end_of_sprint_commit(sprint, branch=branch, repo_root=repo_root):
        errors.append(
            f"Sprint {sprint}: no end_of_sprint_{sprint}: commit on branch {branch!r}"
        )
    if not find_sprint_documents(repo_root, sprint, kind="retro"):
        errors.append(f"Sprint {sprint}: retro file missing under docs/governance/retros/")
    if not find_sprint_documents(repo_root, sprint, kind="health"):
        errors.append(
            f"Sprint {sprint}: health report missing under docs/governance/health-reports/"
        )
    return errors


def fetch_closed_sprint_milestones(
    *,
    repo: str,
    gh_token: str | None,
    title_pattern: str,
) -> list[tuple[int, str]]:
    if not gh_token:
        return []

    import urllib.error
    import urllib.request

    url = f"https://api.github.com/repos/{repo}/milestones?state=closed&per_page=100"
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {gh_token}",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = json.load(response)
    except urllib.error.URLError as exc:
        raise RuntimeError(f"GitHub milestones API failed: {exc}") from exc

    milestones: list[tuple[int, str]] = []
    for item in payload:
        title = item.get("title") or ""
        sprint = parse_sprint_from_milestone_title(title, title_pattern)
        if sprint is not None:
            milestones.append((sprint, title))
    return sorted(milestones, key=lambda pair: pair[0])


def verify_reconcile(
    *,
    repo_root: Path,
    config: dict,
    gh_token: str | None,
    only_sprint: int | None,
    skip_github: bool,
) -> list[str]:
    errors: list[str] = []
    branch = config.get("reconcile_branch", "develop")
    enforce_from = int(config.get("enforce_from_sprint", 37))
    waived = {int(value) for value in config.get("waived_sprints", [])}
    title_pattern = config.get("milestone_title_pattern", r"^Sprint (\d+)\s+—")

    if only_sprint is not None:
        targets = [only_sprint]
    elif skip_github or not gh_token:
        print("SKIP: GitHub milestone scan (no GH_TOKEN or --skip-github).")
        return []
    else:
        repo = os.environ.get("GITHUB_REPOSITORY", "utkanbir/Semantic-Intelligence-Platform")
        closed = fetch_closed_sprint_milestones(
            repo=repo,
            gh_token=gh_token,
            title_pattern=title_pattern,
        )
        targets = [
            sprint
            for sprint, _title in closed
            if sprint >= enforce_from and sprint not in waived
        ]

    for sprint in targets:
        if sprint < enforce_from:
            continue
        if sprint in waived:
            print(f"SKIP: Sprint {sprint} is waived.")
            continue
        errors.extend(
            verify_sprint_artifacts(sprint, repo_root=repo_root, branch=branch)
        )

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify closed sprint milestones vs develop")
    parser.add_argument("--sprint", type=int, help="Verify one sprint number only")
    parser.add_argument("--repo-root", type=Path, default=REPO_ROOT)
    parser.add_argument(
        "--skip-github",
        action="store_true",
        help="Skip GitHub milestone scan (unit tests)",
    )
    args = parser.parse_args()

    config = _load_config()
    gh_token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")

    errors = verify_reconcile(
        repo_root=args.repo_root,
        config=config,
        gh_token=gh_token,
        only_sprint=args.sprint,
        skip_github=args.skip_github,
    )

    if errors:
        print("Sprint milestone reconcile FAILED:", file=sys.stderr)
        for item in errors:
            print(f"  - {item}", file=sys.stderr)
        return 1

    if args.sprint is not None:
        print(f"OK: Sprint {args.sprint} milestone reconcile passed.")
    else:
        print("OK: closed sprint milestone reconcile passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

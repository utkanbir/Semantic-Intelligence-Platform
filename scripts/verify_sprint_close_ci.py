#!/usr/bin/env python3
"""CI entry point for sprint-close governance gates (S36-01).

Detects ``end_of_sprint_<N>:`` commit subjects and, when present, verifies:
  1. Matching retro and health-report markdown files exist
  2. Sprint manifests exist in board/db/deploy expectation JSON files
  3. Deferred-items ledger and retro/health deferral hygiene (S36-02)
  4. GitHub project board state (when GH_TOKEN is available)

When no ``end_of_sprint_*`` commit is detected, exits 0 immediately (no-op).

Cluster DB and deploy gates remain local-only (``verify-sprint-close.ps1``).

Usage:
  python scripts/verify_sprint_close_ci.py --ci-mode
  python scripts/verify_sprint_close_ci.py --ci-mode --git-range origin/develop..HEAD
  python scripts/verify_sprint_close_ci.py --sprint 36
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

END_OF_SPRINT_RE = re.compile(r"^end_of_sprint_(\d+):", re.IGNORECASE)

BOARD_MANIFEST = SCRIPTS_DIR / "sprint_board_expectations.json"
DB_MANIFEST = SCRIPTS_DIR / "sprint_db_expectations.json"
DEPLOY_MANIFEST = SCRIPTS_DIR / "sprint_deploy_expectations.json"

RETRO_GLOB = "Sprint_{sprint}_*_retro.md"
HEALTH_GLOB = "Sprint_{sprint}_*_health.md"


def parse_sprint_from_commit_message(subject: str) -> int | None:
    """Return sprint number when subject matches end_of_sprint_<N>:."""
    match = END_OF_SPRINT_RE.match(subject.strip())
    if match is None:
        return None
    return int(match.group(1))


def detect_sprints_from_commit_messages(messages: list[str]) -> set[int]:
    """Collect sprint numbers referenced by end_of_sprint commit subjects."""
    sprints: set[int] = set()
    for message in messages:
        sprint = parse_sprint_from_commit_message(message)
        if sprint is not None:
            sprints.add(sprint)
    return sprints


def collect_commit_messages_from_git_range(git_range: str, *, repo_root: Path) -> list[str]:
    """Return commit subjects for a git revision range."""
    if not git_range.strip():
        return []
    result = subprocess.run(
        ["git", "log", "--format=%s", git_range],
        capture_output=True,
        text=True,
        check=False,
        cwd=repo_root,
    )
    if result.returncode != 0:
        stderr = result.stderr.strip() or result.stdout.strip()
        raise RuntimeError(f"git log failed for range {git_range!r}: {stderr}")
    return [line for line in result.stdout.splitlines() if line.strip()]


def find_sprint_documents(
    repo_root: Path,
    sprint: int,
    *,
    kind: str,
) -> list[Path]:
    """Return matching retro or health-report paths for a sprint."""
    if kind == "retro":
        pattern = RETRO_GLOB.format(sprint=sprint)
        base = repo_root / "docs" / "governance" / "retros"
    elif kind == "health":
        pattern = HEALTH_GLOB.format(sprint=sprint)
        base = repo_root / "docs" / "governance" / "health-reports"
    else:
        raise ValueError(f"Unknown document kind: {kind!r}")

    if not base.is_dir():
        return []
    return sorted(base.glob(pattern))


def verify_documents(repo_root: Path, sprint: int) -> list[str]:
    """Verify retro and health-report files exist for the sprint."""
    errors: list[str] = []
    retro_files = find_sprint_documents(repo_root, sprint, kind="retro")
    health_files = find_sprint_documents(repo_root, sprint, kind="health")

    if not retro_files:
        expected = RETRO_GLOB.format(sprint=sprint)
        errors.append(
            f"Sprint {sprint} retro missing: expected docs/governance/retros/{expected}"
        )
    if not health_files:
        expected = HEALTH_GLOB.format(sprint=sprint)
        errors.append(
            f"Sprint {sprint} health report missing: "
            f"expected docs/governance/health-reports/{expected}"
        )
    return errors


def _load_json(path: Path) -> dict:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def verify_manifests(sprint: int) -> list[str]:
    """Verify sprint key exists in board, db, and deploy expectation manifests."""
    errors: list[str] = []
    sprint_key = str(sprint)

    if not BOARD_MANIFEST.is_file():
        errors.append(f"Board manifest missing: {BOARD_MANIFEST}")
    else:
        board = _load_json(BOARD_MANIFEST)
        sprint_board = board.get("sprints", {}).get(sprint_key)
        if sprint_board is None:
            errors.append(
                f"Sprint {sprint} missing from {BOARD_MANIFEST.name} "
                f"(add sprints.{sprint_key} with issue list)"
            )
        elif not sprint_board.get("issues"):
            errors.append(
                f"Sprint {sprint} has an empty issues list in {BOARD_MANIFEST.name}. "
                "Add committed sprint issue numbers before sprint close."
            )

    if not DB_MANIFEST.is_file():
        errors.append(f"DB manifest missing: {DB_MANIFEST}")
    else:
        db = _load_json(DB_MANIFEST)
        if sprint_key not in db.get("sprints", {}):
            errors.append(
                f"Sprint {sprint} missing from {DB_MANIFEST.name} "
                f"(add sprints.{sprint_key} with alembic_head and tables)"
            )

    if DEPLOY_MANIFEST.is_file():
        deploy = _load_json(DEPLOY_MANIFEST)
        enforce_from = deploy.get("enforce_from_sprint")
        if enforce_from is not None and sprint >= int(enforce_from):
            if sprint_key not in deploy.get("sprints", {}):
                errors.append(
                    f"Sprint {sprint} missing from {DEPLOY_MANIFEST.name} "
                    f"(add sprints.{sprint_key} with expected sip-dev images)"
                )

    return errors


def verify_board(sprint: int, *, gh_token: str | None) -> list[str]:
    """Run verify_sprint_board.py when a sprint-close commit requires board verification."""
    if not gh_token:
        return [
            "PROJECT_SYNC_TOKEN / GH_TOKEN is not set; board verification required for "
            f"sprint-close commit (Sprint {sprint}). Configure the secret per playbook §8."
        ]

    env = os.environ.copy()
    env["GH_TOKEN"] = gh_token
    result = subprocess.run(
        [sys.executable, str(SCRIPTS_DIR / "verify_sprint_board.py"), "--sprint", str(sprint)],
        capture_output=True,
        text=True,
        check=False,
        env=env,
    )
    if result.returncode == 0:
        return []

    output = (result.stderr or result.stdout or "verify_sprint_board.py failed").strip()
    return [f"Board verification failed for Sprint {sprint}: {output}"]


def verify_sprint_close(
    sprint: int,
    *,
    repo_root: Path,
    ci_mode: bool,
    gh_token: str | None,
    skip_board: bool,
) -> list[str]:
    """Run all applicable gates for one sprint-close; return error messages."""
    errors: list[str] = []
    errors.extend(verify_documents(repo_root, sprint))
    errors.extend(verify_manifests(sprint))

    defer_path = SCRIPTS_DIR / "verify_sprint_deferrals.py"
    if defer_path.is_file():
        env = os.environ.copy()
        if gh_token:
            env["GH_TOKEN"] = gh_token
        result = subprocess.run(
            [sys.executable, str(defer_path), "--sprint", str(sprint)],
            capture_output=True,
            text=True,
            check=False,
            cwd=repo_root,
            env=env,
        )
        if result.returncode != 0:
            output = (result.stderr or result.stdout).strip()
            errors.append(f"Deferral verification failed for Sprint {sprint}: {output}")

    if not skip_board:
        errors.extend(verify_board(sprint, gh_token=gh_token))

    if ci_mode:
        print(
            f"SKIP: cluster DB/deploy gates for Sprint {sprint} require sip-dev; "
            "run verify-sprint-close.ps1 locally before PO handoff."
        )

    return errors


def run(
    *,
    sprints: set[int],
    repo_root: Path,
    ci_mode: bool,
    gh_token: str | None,
    skip_board: bool,
) -> int:
    """Execute verification for detected sprints; return process exit code."""
    if not sprints:
        print("NOOP: no end_of_sprint_* commits detected; sprint governance CI skipped.")
        return 0

    for sprint in sorted(sprints):
        print(f"=== Sprint {sprint} close governance gates (CI) ===")
        errors = verify_sprint_close(
            sprint,
            repo_root=repo_root,
            ci_mode=ci_mode,
            gh_token=gh_token,
            skip_board=skip_board,
        )
        if errors:
            print(f"Sprint {sprint} governance verification FAILED:", file=sys.stderr)
            for item in errors:
                print(f"  - {item}", file=sys.stderr)
            return 1
        print(f"OK: Sprint {sprint} governance gates passed (CI scope).")

    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Sprint-close governance CI gates")
    parser.add_argument("--sprint", type=int, help="Verify a specific sprint (manual override)")
    parser.add_argument(
        "--git-range",
        help="Git revision range for commit subject scan (e.g. origin/develop..HEAD)",
    )
    parser.add_argument(
        "--commit-message",
        action="append",
        dest="commit_messages",
        default=[],
        help="Commit subject line (repeatable; for tests and CI)",
    )
    parser.add_argument(
        "--repo-root",
        type=Path,
        default=REPO_ROOT,
        help="Repository root (default: parent of scripts/)",
    )
    parser.add_argument(
        "--ci-mode",
        action="store_true",
        help="Skip cluster DB/deploy gates (GitHub-hosted CI)",
    )
    parser.add_argument(
        "--skip-board",
        action="store_true",
        help="Skip board verification (tests only)",
    )
    args = parser.parse_args()

    if args.sprint is not None:
        sprints = {args.sprint}
    else:
        messages = list(args.commit_messages)
        if args.git_range:
            messages.extend(
                collect_commit_messages_from_git_range(
                    args.git_range,
                    repo_root=args.repo_root,
                )
            )
        sprints = detect_sprints_from_commit_messages(messages)

    gh_token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    return run(
        sprints=sprints,
        repo_root=args.repo_root,
        ci_mode=args.ci_mode,
        gh_token=gh_token,
        skip_board=args.skip_board,
    )


if __name__ == "__main__":
    sys.exit(main())

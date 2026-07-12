"""Unit tests for scripts/verify_sprint_close_ci.py (S36-01)."""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
SCRIPTS_DIR = REPO_ROOT / "scripts"


def _load_module():
    path = SCRIPTS_DIR / "verify_sprint_close_ci.py"
    spec = importlib.util.spec_from_file_location("verify_sprint_close_ci", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules["verify_sprint_close_ci"] = module
    spec.loader.exec_module(module)
    return module


vsc = _load_module()


def _load_board_module():
    path = SCRIPTS_DIR / "verify_sprint_board.py"
    spec = importlib.util.spec_from_file_location("verify_sprint_board", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


vsc_board = _load_board_module()


@pytest.fixture()
def temp_repo(tmp_path: Path) -> Path:
    """Minimal repo tree with governance folders and manifests."""
    (tmp_path / "docs" / "governance" / "retros").mkdir(parents=True)
    (tmp_path / "docs" / "governance" / "health-reports").mkdir(parents=True)
    scripts = tmp_path / "scripts"
    scripts.mkdir()

    board = {
        "default_expected_status": "Done",
        "sprints": {"36": {"label": "Governance Remediation", "issues": [334]}},
    }
    db = {
        "sprints": {
            "36": {
                "label": "Governance Remediation",
                "alembic_head": "20260706_0019",
                "new_tables": [],
                "cumulative_tables": ["alembic_version"],
            }
        }
    }
    deploy = {"enforce_from_sprint": 31, "sprints": {"36": {"label": "Test", "deployments": []}}}

    (scripts / "sprint_board_expectations.json").write_text(json.dumps(board), encoding="utf-8")
    (scripts / "sprint_db_expectations.json").write_text(json.dumps(db), encoding="utf-8")
    (scripts / "sprint_deploy_expectations.json").write_text(json.dumps(deploy), encoding="utf-8")

    # Point module manifest paths at temp repo scripts dir
    vsc.BOARD_MANIFEST = scripts / "sprint_board_expectations.json"
    vsc.DB_MANIFEST = scripts / "sprint_db_expectations.json"
    vsc.DEPLOY_MANIFEST = scripts / "sprint_deploy_expectations.json"
    vsc.SCRIPTS_DIR = scripts

    yield tmp_path

    # Restore defaults for other tests
    vsc.BOARD_MANIFEST = SCRIPTS_DIR / "sprint_board_expectations.json"
    vsc.DB_MANIFEST = SCRIPTS_DIR / "sprint_db_expectations.json"
    vsc.DEPLOY_MANIFEST = SCRIPTS_DIR / "sprint_deploy_expectations.json"
    vsc.SCRIPTS_DIR = SCRIPTS_DIR


def _write_docs(repo: Path, sprint: int) -> None:
    retro = repo / "docs" / "governance" / "retros" / f"Sprint_{sprint}_Test_retro.md"
    health = repo / "docs" / "governance" / "health-reports" / f"Sprint_{sprint}_Test_health.md"
    retro.write_text("# retro", encoding="utf-8")
    health.write_text("# health", encoding="utf-8")


def test_noop_when_no_end_of_sprint_commit() -> None:
    sprints = vsc.detect_sprints_from_commit_messages(["feat: add widget", "fix: typo"])
    assert sprints == set()
    assert (
        vsc.run(
            sprints=set(),
            repo_root=REPO_ROOT,
            ci_mode=True,
            gh_token=None,
            skip_board=True,
        )
        == 0
    )


def test_fail_when_retro_missing(temp_repo: Path) -> None:
    health = temp_repo / "docs" / "governance" / "health-reports" / "Sprint_36_Test_health.md"
    health.write_text("# health", encoding="utf-8")

    errors = vsc.verify_documents(temp_repo, 36)
    assert any("retro missing" in item for item in errors)


def test_fail_when_health_report_missing(temp_repo: Path) -> None:
    retro = temp_repo / "docs" / "governance" / "retros" / "Sprint_36_Test_retro.md"
    retro.write_text("# retro", encoding="utf-8")

    errors = vsc.verify_documents(temp_repo, 36)
    assert any("health report missing" in item for item in errors)


def test_pass_when_both_documents_exist(temp_repo: Path) -> None:
    _write_docs(temp_repo, 36)
    assert vsc.verify_documents(temp_repo, 36) == []


def test_manifest_empty_issues_produces_clear_error(temp_repo: Path) -> None:
    board_path = temp_repo / "scripts" / "sprint_board_expectations.json"
    board = json.loads(board_path.read_text(encoding="utf-8"))
    board["sprints"]["36"]["issues"] = []
    board_path.write_text(json.dumps(board), encoding="utf-8")

    errors = vsc.verify_manifests(36)
    assert any("empty issues list" in item for item in errors)


def test_verify_sprint_board_rejects_empty_issues_list() -> None:
    board_path = SCRIPTS_DIR / "sprint_board_expectations.json"
    original = board_path.read_text(encoding="utf-8")
    board = json.loads(original)
    board.setdefault("sprints", {})["_empty_test"] = {
        "label": "Empty test sprint",
        "issues": [],
    }
    board_path.write_text(json.dumps(board), encoding="utf-8")
    try:
        errors = vsc_board.verify_sprint("_empty_test")
        assert errors
        assert any("empty issues list" in item.lower() for item in errors)
    finally:
        board_path.write_text(original, encoding="utf-8")


def test_manifest_missing_produces_clear_error(temp_repo: Path) -> None:
    board_path = temp_repo / "scripts" / "sprint_board_expectations.json"
    board = json.loads(board_path.read_text(encoding="utf-8"))
    del board["sprints"]["36"]
    board_path.write_text(json.dumps(board), encoding="utf-8")

    errors = vsc.verify_manifests(36)
    assert any("sprint_board_expectations.json" in item for item in errors)
    assert any("missing from" in item for item in errors)


def test_end_of_sprint_parsing() -> None:
    assert vsc.parse_sprint_from_commit_message("end_of_sprint_36: Close sprint") == 36
    assert vsc.parse_sprint_from_commit_message("End_Of_Sprint_12: retro") == 12
    assert vsc.parse_sprint_from_commit_message("docs: update readme") is None


def test_full_pass_with_skip_board(temp_repo: Path) -> None:
    _write_docs(temp_repo, 36)
    exit_code = vsc.run(
        sprints={36},
        repo_root=temp_repo,
        ci_mode=True,
        gh_token=None,
        skip_board=True,
    )
    assert exit_code == 0


def test_board_token_required_on_sprint_close(temp_repo: Path) -> None:
    _write_docs(temp_repo, 36)
    errors = vsc.verify_board(36, gh_token=None)
    assert len(errors) == 1
    assert "GH_TOKEN" in errors[0] or "PROJECT_SYNC_TOKEN" in errors[0]


def _init_git_repo(repo: Path) -> None:
    import subprocess

    subprocess.run(["git", "init"], cwd=repo, check=True, capture_output=True)
    subprocess.run(["git", "config", "user.email", "test@example.com"], cwd=repo, check=True)
    subprocess.run(["git", "config", "user.name", "Test"], cwd=repo, check=True)
    subprocess.run(["git", "add", "."], cwd=repo, check=True)
    subprocess.run(["git", "commit", "-m", "init"], cwd=repo, check=True)


def test_handoff_skipped_before_sprint_37(temp_repo: Path) -> None:
    assert vsc.verify_handoff_updated(36, repo_root=temp_repo, git_range=None) == []


def test_handoff_fails_when_close_commit_missing_handoff(temp_repo: Path) -> None:
    import subprocess

    _init_git_repo(temp_repo)
    _write_docs(temp_repo, 37)
    subprocess.run(
        ["git", "add", "."],
        cwd=temp_repo,
        check=True,
        capture_output=True,
    )
    subprocess.run(
        ["git", "commit", "-m", "end_of_sprint_37: close without handoff"],
        cwd=temp_repo,
        check=True,
        capture_output=True,
    )
    errors = vsc.verify_handoff_updated(37, repo_root=temp_repo, git_range="HEAD")
    assert errors
    assert any("handoff.md" in item for item in errors)


def test_handoff_passes_when_close_commit_updates_handoff(temp_repo: Path) -> None:
    import subprocess

    _init_git_repo(temp_repo)
    _write_docs(temp_repo, 37)
    handoff = temp_repo / "docs" / "handoff.md"
    handoff.parent.mkdir(parents=True, exist_ok=True)
    handoff.write_text("# handoff\n", encoding="utf-8")
    subprocess.run(["git", "add", "."], cwd=temp_repo, check=True, capture_output=True)
    subprocess.run(
        ["git", "commit", "-m", "end_of_sprint_37: close with handoff"],
        cwd=temp_repo,
        check=True,
        capture_output=True,
    )
    assert vsc.verify_handoff_updated(37, repo_root=temp_repo, git_range="HEAD") == []


def test_handoff_passes_when_close_is_a_merge_commit(temp_repo: Path) -> None:
    """A non-squash sprint-close merge commit still counts the handoff change.

    Reproduces the Sprint 39 close: the ``end_of_sprint_<N>:`` commit is a merge
    commit whose combined diff is empty, but its first-parent diff includes the
    handoff.md update brought in by the merged branch.
    """
    import subprocess

    def _git(*args: str) -> None:
        subprocess.run(["git", *args], cwd=temp_repo, check=True, capture_output=True)

    _init_git_repo(temp_repo)
    _write_docs(temp_repo, 37)
    _git("add", ".")
    _git("commit", "-m", "docs: sprint 37 governance folders")
    _git("branch", "base-tip")

    # Feature branch updates handoff.md, then merge it back with a
    # --no-ff merge whose subject matches end_of_sprint (mirrors gh pr merge --merge).
    _git("switch", "-c", "close-branch")
    handoff = temp_repo / "docs" / "handoff.md"
    handoff.parent.mkdir(parents=True, exist_ok=True)
    handoff.write_text("# handoff\n", encoding="utf-8")
    _git("add", ".")
    _git("commit", "-m", "end_of_sprint_37: close with handoff on branch")

    _git("switch", "base-tip")
    _git(
        "merge",
        "--no-ff",
        "close-branch",
        "-m",
        "end_of_sprint_37: Close Sprint 37 (#999)",
    )

    assert vsc.verify_handoff_updated(37, repo_root=temp_repo, git_range="base-tip") == []

"""Unit tests for scripts/verify_sprint_milestone_reconcile.py (S37-01)."""

from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
SCRIPTS_DIR = REPO_ROOT / "scripts"


def _load_module():
    path = SCRIPTS_DIR / "verify_sprint_milestone_reconcile.py"
    spec = importlib.util.spec_from_file_location("verify_sprint_milestone_reconcile", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules["verify_sprint_milestone_reconcile"] = module
    spec.loader.exec_module(module)
    return module


vmr = _load_module()


@pytest.fixture()
def temp_repo(tmp_path: Path) -> Path:
    (tmp_path / "docs" / "governance" / "retros").mkdir(parents=True)
    (tmp_path / "docs" / "governance" / "health-reports").mkdir(parents=True)
    scripts = tmp_path / "scripts"
    scripts.mkdir()
    config = {
        "reconcile_branch": "develop",
        "enforce_from_sprint": 37,
        "waived_sprints": [29, 30, 33],
        "milestone_title_pattern": r"^Sprint (\d+)\s+—",
    }
    (scripts / "sprint_milestone_reconcile.json").write_text(
        json.dumps(config), encoding="utf-8"
    )
    subprocess.run(["git", "init"], cwd=tmp_path, check=True, capture_output=True)
    subprocess.run(
        ["git", "config", "user.email", "test@example.com"],
        cwd=tmp_path,
        check=True,
        capture_output=True,
    )
    subprocess.run(
        ["git", "config", "user.name", "Test"],
        cwd=tmp_path,
        check=True,
        capture_output=True,
    )
    (tmp_path / "README.md").write_text("x", encoding="utf-8")
    subprocess.run(["git", "add", "."], cwd=tmp_path, check=True, capture_output=True)
    subprocess.run(
        ["git", "commit", "-m", "init"],
        cwd=tmp_path,
        check=True,
        capture_output=True,
    )
    subprocess.run(
        ["git", "branch", "-M", "develop"],
        cwd=tmp_path,
        check=True,
        capture_output=True,
    )
    return tmp_path


def test_parse_sprint_from_milestone_title() -> None:
    assert vmr.parse_sprint_from_milestone_title(
        "Sprint 37 — Governance Hardening",
        r"^Sprint (\d+)\s+—",
    ) == 37
    assert vmr.parse_sprint_from_milestone_title("Backlog", r"^Sprint (\d+)\s+—") is None


def test_verify_sprint_artifacts_missing_commit(temp_repo: Path) -> None:
    (temp_repo / "docs" / "governance" / "retros").mkdir(parents=True, exist_ok=True)
    (temp_repo / "docs" / "governance" / "retros" / "Sprint_37_Governance_Hardening_retro.md").write_text(
        "# retro", encoding="utf-8"
    )
    (temp_repo / "docs" / "governance" / "health-reports").mkdir(parents=True, exist_ok=True)
    (
        temp_repo / "docs" / "governance" / "health-reports" / "Sprint_37_Governance_Hardening_health.md"
    ).write_text("# health", encoding="utf-8")

    errors = vmr.verify_sprint_artifacts(37, repo_root=temp_repo, branch="develop")
    assert any("no end_of_sprint_37" in item for item in errors)


def test_verify_sprint_artifacts_pass(temp_repo: Path) -> None:
    (temp_repo / "docs" / "governance" / "retros").mkdir(parents=True, exist_ok=True)
    (temp_repo / "docs" / "governance" / "retros" / "Sprint_37_Governance_Hardening_retro.md").write_text(
        "# retro", encoding="utf-8"
    )
    (temp_repo / "docs" / "governance" / "health-reports").mkdir(parents=True, exist_ok=True)
    (
        temp_repo / "docs" / "governance" / "health-reports" / "Sprint_37_Governance_Hardening_health.md"
    ).write_text("# health", encoding="utf-8")
    subprocess.run(
        ["git", "commit", "--allow-empty", "-m", "end_of_sprint_37: close"],
        cwd=temp_repo,
        check=True,
        capture_output=True,
    )

    errors = vmr.verify_sprint_artifacts(37, repo_root=temp_repo, branch="develop")
    assert errors == []


def test_sprint_36_close_artifacts_on_real_repo() -> None:
    """Real develop history includes Sprint 36 close commit and docs."""
    errors = vmr.verify_sprint_artifacts(36, repo_root=REPO_ROOT, branch="develop")
    assert errors == []

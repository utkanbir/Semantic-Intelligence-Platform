"""Unit tests for scripts/verify_sprint_retro_delivery.py (S36-07)."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
SCRIPTS_DIR = REPO_ROOT / "scripts"


def _load_module():
    path = SCRIPTS_DIR / "verify_sprint_retro_delivery.py"
    spec = importlib.util.spec_from_file_location("verify_sprint_retro_delivery", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules["verify_sprint_retro_delivery"] = module
    spec.loader.exec_module(module)
    return module


vrd = _load_module()


@pytest.fixture()
def repo(tmp_path: Path) -> Path:
    plan_dir = tmp_path / "docs" / "project"
    retro_dir = tmp_path / "docs" / "governance" / "retros"
    plan_dir.mkdir(parents=True)
    retro_dir.mkdir(parents=True)

    plan_dir.joinpath("Sprint_37_Test_Plan.md").write_text(
        """# Sprint 37

## 3. Committed scope

| ID | Title | Issue |
|----|-------|-------|
| S37-01 | One | #401 |
| S37-02 | Two | #402 |
""",
        encoding="utf-8",
    )
    return tmp_path


def test_skip_before_enforce_from(repo: Path) -> None:
    assert vrd.verify_sprint_retro_delivery(36, repo_root=repo, enforce_from=37) == []


def test_missing_kickoff_link_fails(repo: Path) -> None:
    retro = repo / "docs" / "governance" / "retros" / "Sprint_37_Test_retro.md"
    retro.parent.mkdir(parents=True, exist_ok=True)
    retro.write_text(
        """# retro

## 1. Committed vs delivered

| Issue | Title | Delivered |
|-------|-------|-----------|
| #401 | One | Done |
| #402 | Two | Done |

**Delivery rate:** 2/2 implementation issues.
""",
        encoding="utf-8",
    )
    errors = vrd.verify_sprint_retro_delivery(37, repo_root=repo, enforce_from=37)
    assert any("Kickoff plan" in item for item in errors)


def test_wrong_denominator_fails(repo: Path) -> None:
    retro = repo / "docs" / "governance" / "retros" / "Sprint_37_Test_retro.md"
    retro.write_text(
        """# retro

**Kickoff plan:** `docs/project/Sprint_37_Test_Plan.md`

## 1. Committed vs delivered

| Issue | Title | Delivered |
|-------|-------|-----------|
| #401 | One | Done |

**Delivery rate:** 1/1 implementation issues.
""",
        encoding="utf-8",
    )
    errors = vrd.verify_sprint_retro_delivery(37, repo_root=repo, enforce_from=37)
    assert any("denominator" in item for item in errors)


def test_valid_retro_passes(repo: Path) -> None:
    retro = repo / "docs" / "governance" / "retros" / "Sprint_37_Test_retro.md"
    retro.write_text(
        """# retro

**Kickoff plan:** `docs/project/Sprint_37_Test_Plan.md`

## 1. Committed vs delivered

| Issue | Title | Delivered |
|-------|-------|-----------|
| #401 | One | Done |
| #402 | Two | Done |

**Delivery rate:** 2/2 implementation issues.
""",
        encoding="utf-8",
    )
    errors = vrd.verify_sprint_retro_delivery(37, repo_root=repo, enforce_from=37)
    assert errors == []


def test_not_done_row_does_not_count_as_delivered(repo: Path) -> None:
    retro = repo / "docs" / "governance" / "retros" / "Sprint_37_Test_retro.md"
    retro.write_text(
        """# retro

**Kickoff plan:** `docs/project/Sprint_37_Test_Plan.md`

## 1. Committed vs delivered

| Issue | Title | Delivered |
|-------|-------|-----------|
| #401 | One | Done |
| #402 | Two | Not done |

**Delivery rate:** 1/2 implementation issues.
""",
        encoding="utf-8",
    )
    errors = vrd.verify_sprint_retro_delivery(37, repo_root=repo, enforce_from=37)
    assert errors == []


def test_pr_numbers_in_row_are_ignored(repo: Path) -> None:
    plan_dir = repo / "docs" / "project"
    plan_dir.joinpath("Sprint_36_Noise_Plan.md").write_text(
        """## 3. Committed scope

| ID | Title | Issue |
|----|-------|-------|
| S36-03 | Gate trigger #11-class checks | #338 |
""",
        encoding="utf-8",
    )
    retro = repo / "docs" / "governance" / "retros" / "Sprint_36_Noise_retro.md"
    retro.write_text(
        """**Kickoff plan:** `docs/project/Sprint_36_Noise_Plan.md`

## 1. Committed vs delivered

| Issue | Title | Delivered | PR |
|-------|-------|-----------|-----|
| #338 | Gate | Done | #348 |

**Delivery rate:** 1/1 implementation issues.
""",
        encoding="utf-8",
    )
    errors = vrd.verify_sprint_retro_delivery(36, repo_root=repo, enforce_from=36)
    assert errors == []


def test_real_sprint_36_plan_and_retro_pass() -> None:
    """Fixture against committed Sprint 36 kickoff plan + retro (S37-02)."""
    errors = vrd.verify_sprint_retro_delivery(36, repo_root=REPO_ROOT, enforce_from=36)
    assert errors == []

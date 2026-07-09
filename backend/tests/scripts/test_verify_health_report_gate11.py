"""Unit tests for scripts/verify_health_report_gate11.py (S36-03)."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
SCRIPTS_DIR = REPO_ROOT / "scripts"


def _load_module():
    path = SCRIPTS_DIR / "verify_health_report_gate11.py"
    spec = importlib.util.spec_from_file_location("verify_health_report_gate11", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules["verify_health_report_gate11"] = module
    spec.loader.exec_module(module)
    return module


vhg = _load_module()


@pytest.fixture()
def health_dir(tmp_path: Path) -> Path:
    directory = tmp_path / "docs" / "governance" / "health-reports"
    directory.mkdir(parents=True)
    return directory


def _write_report(path: Path, body: str) -> None:
    path.write_text(body, encoding="utf-8")


def test_skip_before_enforce_from_sprint(health_dir: Path) -> None:
    report = health_dir / "Sprint_35_Test_health.md"
    _write_report(report, "# health\n\n## 1. Summary\n\n**Green.**\n")
    errors = vhg.verify_health_report_gate11(35, repo_root=health_dir.parents[2], enforce_from=36)
    assert errors == []


def test_missing_section_fails_from_sprint_36(health_dir: Path) -> None:
    report = health_dir / "Sprint_36_Test_health.md"
    _write_report(report, "# health\n\n## 1. Summary\n\n**Green.**\n")
    errors = vhg.verify_health_report_gate11(36, repo_root=health_dir.parents[2], enforce_from=36)
    assert any("missing" in item.lower() for item in errors)


def test_green_with_fail_row_fails(health_dir: Path) -> None:
    report = health_dir / "Sprint_36_Test_health.md"
    _write_report(
        report,
        """# health

## 1. Summary

**Green.** All good.

## 9. Gate trigger #11-class checklist

| ID | Check | Result (Pass / Fail / N/A) | Notes |
|----|-------|----------------------------|-------|
| G11-1 | Write paths | Pass | |
| G11-2 | Labels | Fail | mislabeled |
""",
    )
    errors = vhg.verify_health_report_gate11(36, repo_root=health_dir.parents[2], enforce_from=36)
    assert any("Fail result" in item for item in errors)
    assert any("rated Green" in item for item in errors)


def test_all_pass_allows_green(health_dir: Path) -> None:
    report = health_dir / "Sprint_36_Test_health.md"
    _write_report(
        report,
        """# health

## 1. Summary

**Green.** §9 gate-trigger-11 checklist: all Pass/N/A.

## 9. Gate trigger #11-class checklist

| ID | Check | Result (Pass / Fail / N/A) | Notes |
|----|-------|----------------------------|-------|
| G11-1 | Write paths | Pass | |
| G11-2 | Labels | N/A | |
""",
    )
    errors = vhg.verify_health_report_gate11(36, repo_root=health_dir.parents[2], enforce_from=36)
    assert errors == []


def test_amber_with_fail_is_allowed(health_dir: Path) -> None:
    report = health_dir / "Sprint_36_Test_health.md"
    _write_report(
        report,
        """# health

## 1. Summary

**Amber.** Known gap.

## 9. Gate trigger #11-class checklist

| ID | Check | Result (Pass / Fail / N/A) | Notes |
|----|-------|----------------------------|-------|
| G11-1 | Write paths | Pass | |
| G11-2 | Labels | Fail | tracked |
""",
    )
    errors = vhg.verify_health_report_gate11(36, repo_root=health_dir.parents[2], enforce_from=36)
    assert not any("rated Green" in item for item in errors)

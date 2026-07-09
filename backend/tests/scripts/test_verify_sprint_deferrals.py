"""Unit tests for scripts/verify_sprint_deferrals.py (S36-02)."""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
SCRIPTS_DIR = REPO_ROOT / "scripts"


def _load_module():
    path = SCRIPTS_DIR / "verify_sprint_deferrals.py"
    spec = importlib.util.spec_from_file_location("verify_sprint_deferrals", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules["verify_sprint_deferrals"] = module
    spec.loader.exec_module(module)
    return module


vsd = _load_module()


@pytest.fixture()
def temp_repo(tmp_path: Path) -> Path:
    retro = tmp_path / "docs" / "governance" / "retros" / "Sprint_36_Test_retro.md"
    health = tmp_path / "docs" / "governance" / "health-reports" / "Sprint_36_Test_health.md"
    retro.parent.mkdir(parents=True)
    health.parent.mkdir(parents=True)
    retro.write_text("# retro\n", encoding="utf-8")
    health.write_text("# health\n", encoding="utf-8")

    ledger = {
        "items": [
            {
                "id": "TD-018",
                "title": "Test",
                "github_issue": 346,
                "target_milestone": "Technical Debt Backlog",
                "status": "open",
            }
        ]
    }
    ledger_path = tmp_path / "scripts" / "deferred_items_ledger.json"
    ledger_path.parent.mkdir()
    ledger_path.write_text(json.dumps(ledger), encoding="utf-8")
    vsd.LEDGER_PATH = ledger_path
    yield tmp_path
    vsd.LEDGER_PATH = SCRIPTS_DIR / "deferred_items_ledger.json"


def test_ledger_structure_requires_github_issue(tmp_path: Path) -> None:
    ledger_path = tmp_path / "ledger.json"
    ledger_path.write_text(
        json.dumps({"items": [{"id": "X", "status": "open", "target_milestone": "M"}]}),
        encoding="utf-8",
    )
    errors = vsd.validate_ledger_structure(json.loads(ledger_path.read_text()))
    assert any("missing github_issue" in item for item in errors)


def test_unlinked_deferral_line_fails(temp_repo: Path) -> None:
    retro = temp_repo / "docs" / "governance" / "retros" / "Sprint_36_Test_retro.md"
    retro.write_text(
        "# retro\n\n- Add auth ADR (deferred to next sprint).\n",
        encoding="utf-8",
    )
    index = vsd._ledger_index(vsd._load_ledger(vsd.LEDGER_PATH))
    errors = vsd.scan_sprint_documents(temp_repo, 36, index)
    assert any("deferral without linked issue" in item for item in errors)


def test_td_id_in_line_passes_via_ledger(temp_repo: Path) -> None:
    retro = temp_repo / "docs" / "governance" / "retros" / "Sprint_36_Test_retro.md"
    retro.write_text(
        "# retro\n\n- Evaluate persisting trace_audience on write path (TD-018).\n",
        encoding="utf-8",
    )
    index = vsd._ledger_index(vsd._load_ledger(vsd.LEDGER_PATH))
    errors = vsd.scan_sprint_documents(temp_repo, 36, index)
    assert errors == []


def test_issue_hash_in_line_passes(temp_repo: Path) -> None:
    retro = temp_repo / "docs" / "governance" / "retros" / "Sprint_36_Test_retro.md"
    retro.write_text(
        "# retro\n\n- Auth ADR deferred; tracked in #343.\n",
        encoding="utf-8",
    )
    index = vsd._ledger_index(vsd._load_ledger(vsd.LEDGER_PATH))
    errors = vsd.scan_sprint_documents(temp_repo, 36, index)
    assert errors == []


def test_real_ledger_has_four_seeded_items() -> None:
    ledger = vsd._load_ledger(SCRIPTS_DIR / "deferred_items_ledger.json")
    open_items = [i for i in ledger["items"] if i.get("status") == "open"]
    assert len(open_items) == 4
    assert {i["github_issue"] for i in open_items} == {343, 344, 345, 346}

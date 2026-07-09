"""Unit tests for scripts/verify_contract_sync.py (S36-05)."""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
SCRIPTS_DIR = REPO_ROOT / "scripts"


def _load_module():
    path = SCRIPTS_DIR / "verify_contract_sync.py"
    spec = importlib.util.spec_from_file_location("verify_contract_sync", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules["verify_contract_sync"] = module
    spec.loader.exec_module(module)
    return module


vcs = _load_module()


def test_normalize_path_maps_param_names() -> None:
    assert vcs.normalize_path("/api/v1/ontologies/{ontology_id}") == "/api/v1/ontologies/{id}"
    assert vcs.normalize_path("/ontologies/generate") == "/api/v1/ontologies/generate"


def test_parse_contract_includes_generate_route() -> None:
    routes = vcs.parse_contract_routes(REPO_ROOT / "docs" / "architecture")
    assert ("POST", "/api/v1/ontologies/generate") in routes


def test_missing_generate_in_contract_fails(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    contract_dir = tmp_path / "contracts"
    contract_dir.mkdir()
    (contract_dir / "SIP_Test_Contract_v1.md").write_text(
        "| Method | Path | Notes |\n|--------|------|-------|\n"
        "| `GET` | `/api/v1/health` | ok |\n",
        encoding="utf-8",
    )
    baseline = tmp_path / "baseline.json"
    baseline.write_text(json.dumps({"routes": []}), encoding="utf-8")

    live_routes = {
        ("GET", "/api/v1/health"),
        ("POST", "/api/v1/ontologies/generate"),
    }
    monkeypatch.setattr(vcs, "collect_live_routes", lambda: live_routes)

    errors = vcs.verify_contract_sync(contract_dir=contract_dir, baseline_path=baseline)
    assert any("ontologies/generate" in item for item in errors)


def test_baseline_grandfathers_route(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    contract_dir = tmp_path / "contracts"
    contract_dir.mkdir()
    (contract_dir / "SIP_Test_Contract_v1.md").write_text("# empty\n", encoding="utf-8")
    baseline = tmp_path / "baseline.json"
    baseline.write_text(
        json.dumps(
            {
                "routes": [
                    {
                        "method": "POST",
                        "path": "/api/v1/ontologies/generate",
                        "reason": "test",
                    }
                ]
            }
        ),
        encoding="utf-8",
    )

    monkeypatch.setattr(
        vcs,
        "collect_live_routes",
        lambda: {("POST", "/api/v1/ontologies/generate")},
    )
    errors = vcs.verify_contract_sync(contract_dir=contract_dir, baseline_path=baseline)
    assert errors == []


def test_real_repo_contract_sync_passes() -> None:
    errors = vcs.verify_contract_sync(
        contract_dir=REPO_ROOT / "docs" / "architecture",
        baseline_path=SCRIPTS_DIR / "contract_sync_baseline.json",
    )
    assert errors == []

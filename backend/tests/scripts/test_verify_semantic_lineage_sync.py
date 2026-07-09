"""Unit tests for scripts/verify_semantic_lineage_sync.py (S37-04)."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
SCRIPTS_DIR = REPO_ROOT / "scripts"


def _load_module():
    path = SCRIPTS_DIR / "verify_semantic_lineage_sync.py"
    spec = importlib.util.spec_from_file_location("verify_semantic_lineage_sync", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules["verify_semantic_lineage_sync"] = module
    spec.loader.exec_module(module)
    return module


vsl = _load_module()


def test_real_repo_semantic_lineage_parity() -> None:
    assert vsl.verify_semantic_lineage_sync() == []


def test_detects_missing_contract_type(tmp_path: Path) -> None:
    contract = tmp_path / "docs" / "governance" / "SIP_Semantic_Transaction_Taxonomy_and_Eligibility_Contract.md"
    contract.parent.mkdir(parents=True)
    contract.write_text(
        """### 6.1 Semantic lineage (`semantic_lineage`)

| `ontology.created` | `OntologyDefinition` | origin |
""",
        encoding="utf-8",
    )
    errors = vsl.verify_semantic_lineage_sync(
        repo_root=tmp_path,
        taxonomy_contract=contract,
    )
    assert any("missing from taxonomy" in item for item in errors)

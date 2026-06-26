"""Alembic baseline smoke tests (no live database required)."""

from pathlib import Path


def test_alembic_initial_revision_exists() -> None:
    versions = Path(__file__).resolve().parent.parent / "alembic" / "versions"
    files = list(versions.glob("*.py"))
    assert len(files) >= 1
    assert any("initial_baseline" in f.name for f in files)


def test_alembic_ini_exists() -> None:
    ini = Path(__file__).resolve().parent.parent / "alembic.ini"
    assert ini.is_file()
    assert "script_location = alembic" in ini.read_text(encoding="utf-8")

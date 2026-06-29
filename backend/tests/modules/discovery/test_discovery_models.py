"""Tests for discovery domain + ORM models."""

from app.modules.discovery.repositories.orm_models import DiscoveryPhaseHistory, DiscoverySession


def test_discovery_session_requires_application_fk() -> None:
    table = DiscoverySession.__table__

    fk = next(
        constraint
        for constraint in table.foreign_key_constraints
        if "application_id" in {column.name for column in constraint.columns}
    )
    assert fk.referred_table.name == "applications"
    assert table.columns["application_id"].nullable is False


def test_discovery_session_required_scalar_fields() -> None:
    table = DiscoverySession.__table__
    required_fields = {"status", "title", "started_by", "started_at"}

    for field in required_fields:
        assert table.columns[field].nullable is False


def test_discovery_session_optional_fields() -> None:
    table = DiscoverySession.__table__
    optional_fields = {
        "completed_at",
        "intent_summary",
        "discovery_notes",
        "recommendations",
        "generated_blueprint_id",
        "conversation_history",
    }

    for field in optional_fields:
        assert table.columns[field].nullable is True


def test_discovery_phase_history_requires_session_fk() -> None:
    table = DiscoveryPhaseHistory.__table__

    fk = next(
        constraint
        for constraint in table.foreign_key_constraints
        if "session_id" in {column.name for column in constraint.columns}
    )
    assert fk.referred_table.name == "discovery_sessions"
    assert table.columns["session_id"].nullable is False


def test_discovery_phase_history_required_fields() -> None:
    table = DiscoveryPhaseHistory.__table__
    required_fields = {"phase_number", "phase_name", "entered_at"}

    for field in required_fields:
        assert table.columns[field].nullable is False

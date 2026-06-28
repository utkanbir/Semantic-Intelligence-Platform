"""Repository round-trip tests for discovery persistence."""

from __future__ import annotations

from collections.abc import Generator
from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.modules.applications.repositories.orm_models  # noqa: F401
import app.modules.discovery.repositories.orm_models  # noqa: F401
from app.modules.applications.domain.enums import ApplicationStatus
from app.modules.applications.domain.models import Application, ApplicationWorkspace
from app.modules.applications.repositories.orm_models import Base as ApplicationsBase
from app.modules.applications.repositories.sqlalchemy_repository import (
    SqlAlchemyApplicationRepository,
)
from app.modules.discovery.domain.enums import (
    DiscoveryPhaseNumber,
    DiscoverySessionStatus,
    phase_name_for_number,
)
from app.modules.discovery.domain.models import DiscoveryPhaseHistory, DiscoverySession
from app.modules.discovery.repositories.sqlalchemy_repository import SqlAlchemyDiscoveryRepository


@pytest.fixture()
def db_engine() -> Generator[Engine, None, None]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    ApplicationsBase.metadata.create_all(bind=engine)
    yield engine
    ApplicationsBase.metadata.drop_all(bind=engine)


@pytest.fixture()
def db_session(db_engine: Engine) -> Generator[Session, None, None]:
    session = sessionmaker(
        bind=db_engine,
        autoflush=False,
        autocommit=False,
        class_=Session,
    )()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def application_id(db_session: Session) -> UUID:
    application = Application(
        id=uuid4(),
        key="discovery-test-app",
        name="Discovery Test App",
        status=ApplicationStatus.PROVISIONED,
        workspace=ApplicationWorkspace(
            id=uuid4(),
            application_id=uuid4(),
            postgres_schema="sip_discovery_test_app",
            minio_namespace="sip-discovery-test-app",
            fuseki_dataset="sip/discovery-test-app",
            qdrant_collection="sip_discovery_test_app",
            metadata_domain="sip-discovery-test-app",
            ontology_namespace="sip.discovery-test-app.ontology",
            agent_namespace="sip-discovery-test-app.agents",
            product_registry_namespace="sip-discovery-test-app.products",
            agent_registry_namespace="sip-discovery-test-app.agent-runtime",
        ),
    )
    application.workspace.application_id = application.id
    persisted = SqlAlchemyApplicationRepository(db_session).create(application)
    return persisted.id


def _build_session(application_id: UUID) -> DiscoverySession:
    session_id = uuid4()
    started_at = datetime(2026, 6, 28, 12, 0, 0, tzinfo=UTC)
    return DiscoverySession(
        id=session_id,
        application_id=application_id,
        status=DiscoverySessionStatus.ACTIVE,
        title="Initial discovery",
        started_by="test-user",
        started_at=started_at,
        recommendations=[],
        conversation_history=[],
        phase_history=[
            DiscoveryPhaseHistory(
                id=uuid4(),
                session_id=session_id,
                phase_number=DiscoveryPhaseNumber.INTENT_DISCOVERY,
                phase_name=phase_name_for_number(DiscoveryPhaseNumber.INTENT_DISCOVERY),
                entered_at=started_at,
            )
        ],
    )


def test_create_and_get_discovery_session_round_trip(
    db_session: Session,
    application_id: UUID,
) -> None:
    repository = SqlAlchemyDiscoveryRepository(db_session)
    created = repository.create(_build_session(application_id))

    loaded = repository.get(created.id)

    assert loaded is not None
    assert loaded.id == created.id
    assert loaded.application_id == application_id
    assert loaded.status == DiscoverySessionStatus.ACTIVE
    assert loaded.title == "Initial discovery"
    assert loaded.started_by == "test-user"
    assert loaded.recommendations == []
    assert loaded.conversation_history == []
    assert len(loaded.phase_history) == 1
    assert loaded.current_phase is not None
    assert loaded.current_phase.phase_number == 1
    assert loaded.current_phase.phase_name == "Intent Discovery"


def test_list_by_application_returns_sessions(
    db_session: Session,
    application_id: UUID,
) -> None:
    repository = SqlAlchemyDiscoveryRepository(db_session)
    first = repository.create(_build_session(application_id))
    second_session = _build_session(application_id)
    second_session.title = "Second discovery"
    second = repository.create(second_session)

    sessions = repository.list_by_application(application_id)

    assert len(sessions) == 2
    assert {item.id for item in sessions} == {first.id, second.id}


def test_update_discovery_session_scalar_fields(
    db_session: Session,
    application_id: UUID,
) -> None:
    repository = SqlAlchemyDiscoveryRepository(db_session)
    created = repository.create(_build_session(application_id))
    created.title = "Updated title"
    created.intent_summary = "Capture business goals"
    created.discovery_notes = "Notes from kickoff"
    created.recommendations = [{"topic": "users"}]
    created.conversation_history = [
        {"role": "user", "content": "Hello", "timestamp": "2026-06-28T12:00:00Z"}
    ]

    updated = repository.update(created)
    loaded = repository.get(created.id)

    assert updated is not None
    assert loaded is not None
    assert loaded.title == "Updated title"
    assert loaded.intent_summary == "Capture business goals"
    assert loaded.discovery_notes == "Notes from kickoff"
    assert loaded.recommendations == [{"topic": "users"}]
    assert loaded.conversation_history == [
        {"role": "user", "content": "Hello", "timestamp": "2026-06-28T12:00:00Z"}
    ]


def test_append_phase_history_is_append_only(
    db_session: Session,
    application_id: UUID,
) -> None:
    repository = SqlAlchemyDiscoveryRepository(db_session)
    created = repository.create(_build_session(application_id))
    next_entered_at = datetime(2026, 6, 28, 13, 0, 0, tzinfo=UTC)

    appended = repository.append_phase_history(
        DiscoveryPhaseHistory(
            id=uuid4(),
            session_id=created.id,
            phase_number=DiscoveryPhaseNumber.USER_DISCOVERY,
            phase_name=phase_name_for_number(DiscoveryPhaseNumber.USER_DISCOVERY),
            entered_at=next_entered_at,
            notes="Moved to user interviews",
        )
    )
    history = repository.list_phase_history(created.id)
    loaded = repository.get(created.id)

    assert appended.phase_number == 2
    assert len(history) == 2
    assert history[0].phase_number == 1
    assert history[1].phase_number == 2
    assert history[1].notes == "Moved to user interviews"
    assert loaded is not None
    assert loaded.current_phase is not None
    assert loaded.current_phase.phase_number == 2
    assert loaded.current_phase.phase_name == "User Discovery"

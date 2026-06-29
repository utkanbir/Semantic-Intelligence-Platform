"""Repository round-trip tests for agent definition persistence."""

from __future__ import annotations

from collections.abc import Generator
from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.modules.agents.repositories.orm_models  # noqa: F401
import app.modules.applications.repositories.orm_models  # noqa: F401
from app.modules.agents.domain.enums import AgentDefinitionStatus
from app.modules.agents.domain.models import AgentDefinition
from app.modules.agents.repositories.sqlalchemy_repository import (
    SqlAlchemyAgentDefinitionRepository,
)
from app.modules.applications.domain.enums import ApplicationStatus
from app.modules.applications.domain.models import Application, ApplicationWorkspace
from app.modules.applications.repositories.orm_models import Base as ApplicationsBase
from app.modules.applications.repositories.sqlalchemy_repository import (
    SqlAlchemyApplicationRepository,
)


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
        key="agent-test-app",
        name="Agent Test App",
        status=ApplicationStatus.PROVISIONED,
        workspace=ApplicationWorkspace(
            id=uuid4(),
            application_id=uuid4(),
            postgres_schema="sip_agent_test_app",
            minio_namespace="sip-agent-test-app",
            fuseki_dataset="sip/agent-test-app",
            qdrant_collection="sip_agent_test_app",
            metadata_domain="sip-agent-test-app",
            ontology_namespace="sip.agent-test-app.ontology",
            agent_namespace="sip.agent-test-app.agents",
            product_registry_namespace="sip.agent-test-app.products",
            agent_registry_namespace="sip.agent-test-app.agent-runtime",
        ),
    )
    application.workspace.application_id = application.id
    persisted = SqlAlchemyApplicationRepository(db_session).create(application)
    return persisted.id


def test_create_and_get_agent_definition(db_session: Session, application_id: UUID) -> None:
    repo = SqlAlchemyAgentDefinitionRepository(db_session)
    agent_id = uuid4()
    created_at = datetime(2026, 6, 29, 10, 0, 0, tzinfo=UTC)
    definition = {"persona": "Analyst", "instructions": "Summarize vendors"}

    created = repo.create(
        AgentDefinition(
            id=agent_id,
            application_id=application_id,
            version_number=1,
            status=AgentDefinitionStatus.DRAFT,
            title="Vendor Analyst Agent",
            created_by="architect-1",
            created_at=created_at,
            updated_at=created_at,
            agent_definition=definition,
            bound_product_ids=[],
        )
    )

    assert created.id == agent_id
    assert created.status == AgentDefinitionStatus.DRAFT
    assert created.agent_definition == definition

    loaded = repo.get(agent_id)
    assert loaded is not None
    assert loaded.title == "Vendor Analyst Agent"


def test_list_agent_definitions_by_application(
    db_session: Session, application_id: UUID
) -> None:
    repo = SqlAlchemyAgentDefinitionRepository(db_session)
    now = datetime(2026, 6, 29, 10, 0, 0, tzinfo=UTC)

    repo.create(
        AgentDefinition(
            id=uuid4(),
            application_id=application_id,
            version_number=1,
            status=AgentDefinitionStatus.DRAFT,
            title="v1",
            created_by="user-1",
            created_at=now,
            updated_at=now,
            agent_definition={},
            bound_product_ids=[],
        )
    )
    repo.create(
        AgentDefinition(
            id=uuid4(),
            application_id=application_id,
            version_number=2,
            status=AgentDefinitionStatus.APPROVED,
            title="v2",
            created_by="user-1",
            created_at=now,
            updated_at=now,
            agent_definition={},
            bound_product_ids=[],
        )
    )

    all_agents = repo.list_by_application(application_id)
    assert len(all_agents) == 2
    assert all_agents[0].version_number == 2

    approved_only = repo.list_by_application(
        application_id,
        status=AgentDefinitionStatus.APPROVED.value,
    )
    assert len(approved_only) == 1
    assert approved_only[0].title == "v2"

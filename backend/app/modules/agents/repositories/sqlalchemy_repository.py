"""SQLAlchemy repository implementations for the agents module."""

from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.agents.domain.enums import AgentDefinitionStatus
from app.modules.agents.domain.models import AgentDefinition
from app.modules.agents.repositories.interfaces import AgentDefinitionRepository
from app.modules.agents.repositories.orm_models import AgentDefinition as AgentDefinitionORM


def _to_domain(agent_orm: AgentDefinitionORM) -> AgentDefinition:
    return AgentDefinition(
        id=agent_orm.id,
        application_id=agent_orm.application_id,
        version_number=agent_orm.version_number,
        previous_version_id=agent_orm.previous_version_id,
        status=AgentDefinitionStatus(agent_orm.status),
        title=agent_orm.title,
        description=agent_orm.description,
        created_by=agent_orm.created_by,
        created_at=agent_orm.created_at,
        updated_at=agent_orm.updated_at,
        approved_at=agent_orm.approved_at,
        activated_at=agent_orm.activated_at,
        version_created_at=agent_orm.version_created_at,
        agent_definition=agent_orm.agent_definition or {},
        bound_product_ids=list(agent_orm.bound_product_ids or []),
    )


class SqlAlchemyAgentDefinitionRepository(AgentDefinitionRepository):
    """SQLAlchemy-backed implementation for agent definition persistence."""

    def __init__(self, session: Session) -> None:
        self._session = session

    def create(self, agent: AgentDefinition) -> AgentDefinition:
        agent_orm = AgentDefinitionORM(
            id=agent.id,
            application_id=agent.application_id,
            version_number=agent.version_number,
            previous_version_id=agent.previous_version_id,
            status=agent.status.value,
            title=agent.title,
            description=agent.description,
            created_by=agent.created_by,
            created_at=agent.created_at,
            updated_at=agent.updated_at,
            approved_at=agent.approved_at,
            activated_at=agent.activated_at,
            version_created_at=agent.version_created_at,
            agent_definition=agent.agent_definition,
            bound_product_ids=agent.bound_product_ids,
        )
        self._session.add(agent_orm)
        self._session.commit()
        self._session.refresh(agent_orm)
        return _to_domain(agent_orm)

    def list_by_application(
        self,
        application_id: UUID,
        *,
        status: str | None = None,
    ) -> Sequence[AgentDefinition]:
        statement = (
            select(AgentDefinitionORM)
            .where(AgentDefinitionORM.application_id == application_id)
            .order_by(AgentDefinitionORM.version_number.desc())
        )
        if status is not None:
            statement = statement.where(AgentDefinitionORM.status == status)
        return [_to_domain(item) for item in self._session.scalars(statement).all()]

    def get(self, agent_id: UUID) -> AgentDefinition | None:
        agent_orm = self._session.get(AgentDefinitionORM, agent_id)
        return _to_domain(agent_orm) if agent_orm else None

    def update(self, agent: AgentDefinition) -> AgentDefinition | None:
        agent_orm = self._session.get(AgentDefinitionORM, agent.id)
        if agent_orm is None:
            return None

        agent_orm.status = agent.status.value
        agent_orm.title = agent.title
        agent_orm.description = agent.description
        agent_orm.updated_at = agent.updated_at
        agent_orm.approved_at = agent.approved_at
        agent_orm.activated_at = agent.activated_at
        agent_orm.version_created_at = agent.version_created_at
        agent_orm.agent_definition = agent.agent_definition
        agent_orm.bound_product_ids = agent.bound_product_ids

        self._session.commit()
        self._session.refresh(agent_orm)
        return _to_domain(agent_orm)

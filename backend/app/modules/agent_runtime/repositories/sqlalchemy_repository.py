"""SQLAlchemy repository implementations for the agent_runtime module."""

from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.agent_runtime.domain.enums import AgentRunStatus
from app.modules.agent_runtime.domain.models import AgentRun
from app.modules.agent_runtime.repositories.interfaces import AgentRunRepository
from app.modules.agent_runtime.repositories.orm_models import AgentRun as AgentRunORM


def _to_domain(run_orm: AgentRunORM) -> AgentRun:
    return AgentRun(
        id=run_orm.id,
        application_id=run_orm.application_id,
        agent_definition_id=run_orm.agent_definition_id,
        status=AgentRunStatus(run_orm.status),
        created_by=run_orm.created_by,
        created_at=run_orm.created_at,
        updated_at=run_orm.updated_at,
        started_at=run_orm.started_at,
        completed_at=run_orm.completed_at,
        run_payload=run_orm.run_payload or {},
        run_result=run_orm.run_result,
    )


class SqlAlchemyAgentRunRepository(AgentRunRepository):
    """SQLAlchemy-backed implementation for agent run persistence."""

    def __init__(self, session: Session) -> None:
        self._session = session

    def create(self, agent_run: AgentRun) -> AgentRun:
        run_orm = AgentRunORM(
            id=agent_run.id,
            application_id=agent_run.application_id,
            agent_definition_id=agent_run.agent_definition_id,
            status=agent_run.status.value,
            created_by=agent_run.created_by,
            created_at=agent_run.created_at,
            updated_at=agent_run.updated_at,
            started_at=agent_run.started_at,
            completed_at=agent_run.completed_at,
            run_payload=agent_run.run_payload,
            run_result=agent_run.run_result,
        )
        self._session.add(run_orm)
        self._session.commit()
        self._session.refresh(run_orm)
        return _to_domain(run_orm)

    def list_by_application(
        self,
        application_id: UUID,
        *,
        status: str | None = None,
    ) -> Sequence[AgentRun]:
        statement = select(AgentRunORM).where(AgentRunORM.application_id == application_id)
        if status is not None:
            statement = statement.where(AgentRunORM.status == status)
        return [_to_domain(item) for item in self._session.scalars(statement).all()]

    def get(self, run_id: UUID) -> AgentRun | None:
        run_orm = self._session.get(AgentRunORM, run_id)
        return _to_domain(run_orm) if run_orm else None

    def update(self, agent_run: AgentRun) -> AgentRun | None:
        run_orm = self._session.get(AgentRunORM, agent_run.id)
        if run_orm is None:
            return None
        run_orm.status = agent_run.status.value
        run_orm.updated_at = agent_run.updated_at
        run_orm.started_at = agent_run.started_at
        run_orm.completed_at = agent_run.completed_at
        run_orm.run_payload = agent_run.run_payload
        run_orm.run_result = agent_run.run_result
        self._session.commit()
        self._session.refresh(run_orm)
        return _to_domain(run_orm)

"""REST API routes for the knowledge_graph module."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.infrastructure.database import get_db
from app.modules.applications.repositories.sqlalchemy_repository import (
    SqlAlchemyApplicationRepository,
)
from app.modules.audit_trace.repositories.sqlalchemy_repository import (
    SqlAlchemyAuditTraceRepository,
)
from app.modules.knowledge_graph.api.schemas import (
    KnowledgeGraphRegistryCreateRequest,
    KnowledgeGraphRegistryResponse,
    KnowledgeGraphRegistryStatusUpdateRequest,
    KnowledgeGraphRegistryUpdateRequest,
    to_knowledge_graph_registry_response,
)
from app.modules.knowledge_graph.domain.enums import KnowledgeGraphRegistryStatus
from app.modules.knowledge_graph.repositories.sqlalchemy_repository import (
    SqlAlchemyKnowledgeGraphRegistryRepository,
)
from app.modules.knowledge_graph.services.knowledge_graph_service import (
    UNSET,
    ApplicationNotFoundError,
    ImmutableKnowledgeGraphRegistryError,
    InvalidKnowledgeGraphStatusTransitionError,
    InvalidOntologyBindingError,
    KnowledgeGraphRegistryNotFoundError,
    KnowledgeGraphService,
    OntologyDefinitionNotFoundError,
)
from app.modules.ontology.repositories.sqlalchemy_repository import (
    SqlAlchemyOntologyDefinitionRepository,
)

router = APIRouter()
DbSession = Annotated[Session, Depends(get_db)]


class SqlAlchemyTraceRecorderAdapter:
    def __init__(self, session: Session) -> None:
        self._repository = SqlAlchemyAuditTraceRepository(session)

    def record_transaction(
        self,
        *,
        transaction_type: str,
        resource_type: str,
        resource_id: str,
    ) -> None:
        self._repository.record_transaction(
            transaction_type=transaction_type,
            resource_type=resource_type,
            resource_id=resource_id,
        )


class SqlAlchemyPublishedOntologyReaderAdapter:
    def __init__(self, session: Session) -> None:
        self._repository = SqlAlchemyOntologyDefinitionRepository(session)

    def get_ontology_status(self, ontology_id: UUID) -> str | None:
        ontology = self._repository.get(ontology_id)
        return ontology.status.value if ontology else None

    def get_application_id(self, ontology_id: UUID) -> UUID | None:
        ontology = self._repository.get(ontology_id)
        return ontology.application_id if ontology else None


def _get_service(db: Session) -> KnowledgeGraphService:
    return KnowledgeGraphService(
        SqlAlchemyKnowledgeGraphRegistryRepository(db),
        SqlAlchemyApplicationRepository(db),
        SqlAlchemyPublishedOntologyReaderAdapter(db),
        SqlAlchemyTraceRecorderAdapter(db),
    )


@router.post("", response_model=KnowledgeGraphRegistryResponse, status_code=status.HTTP_201_CREATED)
def create_knowledge_graph(
    payload: KnowledgeGraphRegistryCreateRequest, db: DbSession
) -> KnowledgeGraphRegistryResponse:
    service = _get_service(db)
    try:
        registry = service.create_registry(
            application_id=payload.application_id,
            title=payload.title,
            created_by=payload.created_by,
            description=payload.description,
            graph_metadata=payload.graph_metadata,
            bound_ontology_ids=payload.bound_ontology_ids,
        )
    except ApplicationNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except OntologyDefinitionNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except InvalidOntologyBindingError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    return to_knowledge_graph_registry_response(registry)


@router.get("", response_model=list[KnowledgeGraphRegistryResponse])
def list_knowledge_graphs(
    db: DbSession,
    application_id: Annotated[UUID, Query()],
    graph_status: Annotated[KnowledgeGraphRegistryStatus | None, Query()] = None,
) -> list[KnowledgeGraphRegistryResponse]:
    service = _get_service(db)
    try:
        registries = service.list_registries(
            application_id=application_id, status=graph_status
        )
    except ApplicationNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    return [to_knowledge_graph_registry_response(item) for item in registries]


@router.get("/{registry_id}", response_model=KnowledgeGraphRegistryResponse)
def get_knowledge_graph(registry_id: UUID, db: DbSession) -> KnowledgeGraphRegistryResponse:
    service = _get_service(db)
    try:
        registry = service.get_registry(registry_id)
    except KnowledgeGraphRegistryNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    return to_knowledge_graph_registry_response(registry)


@router.patch("/{registry_id}", response_model=KnowledgeGraphRegistryResponse)
def update_knowledge_graph(
    registry_id: UUID, payload: KnowledgeGraphRegistryUpdateRequest, db: DbSession
) -> KnowledgeGraphRegistryResponse:
    service = _get_service(db)
    provided_values = payload.model_dump(exclude_unset=True)
    try:
        registry = service.update_registry(
            registry_id,
            title=provided_values.get("title"),
            description=provided_values.get("description", UNSET),
            graph_metadata=provided_values.get("graph_metadata", UNSET),
            bound_ontology_ids=provided_values.get("bound_ontology_ids", UNSET),
        )
    except KnowledgeGraphRegistryNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except ImmutableKnowledgeGraphRegistryError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    except OntologyDefinitionNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except InvalidOntologyBindingError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    return to_knowledge_graph_registry_response(registry)


@router.patch("/{registry_id}/status", response_model=KnowledgeGraphRegistryResponse)
def update_knowledge_graph_status(
    registry_id: UUID, payload: KnowledgeGraphRegistryStatusUpdateRequest, db: DbSession
) -> KnowledgeGraphRegistryResponse:
    service = _get_service(db)
    try:
        registry = service.update_status(registry_id, status=payload.status)
    except KnowledgeGraphRegistryNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except InvalidKnowledgeGraphStatusTransitionError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    except InvalidOntologyBindingError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    return to_knowledge_graph_registry_response(registry)

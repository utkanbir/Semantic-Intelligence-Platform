"""REST API routes for the ontology module."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.infrastructure.adapters.fuseki import FusekiImportError
from app.infrastructure.adapters.knowledge_graph_resolver import (
    UnsupportedKnowledgeGraphVendorError,
    resolve_knowledge_graph_port,
)
from app.infrastructure.database import get_db
from app.modules.adapters.domain.models import TechnologyAdapter
from app.modules.adapters.repositories.sqlalchemy_repository import (
    SqlAlchemyTechnologyAdapterRepository,
)
from app.modules.applications.repositories.sqlalchemy_repository import (
    SqlAlchemyApplicationRepository,
)
from app.modules.audit_trace.repositories.sqlalchemy_repository import (
    SqlAlchemyAuditTraceRepository,
)
from app.modules.ontology.api.schemas import (
    OntologyDefinitionCreateRequest,
    OntologyDefinitionImportRequest,
    OntologyDefinitionResponse,
    OntologyDefinitionStatusUpdateRequest,
    OntologyDefinitionUpdateRequest,
    OntologyDefinitionVersionCreateRequest,
    to_ontology_definition_response,
)
from app.modules.ontology.domain.enums import OntologyDefinitionStatus
from app.modules.ontology.repositories.sqlalchemy_repository import (
    SqlAlchemyOntologyDefinitionRepository,
)
from app.modules.ontology.services.ontology_service import (
    UNSET,
    ApplicationNotFoundError,
    ApplicationWorkspaceNotFoundError,
    ConnectorNotFoundError,
    ImmutableOntologyDefinitionError,
    InvalidOntologyConnectorError,
    InvalidOntologyDefinitionStatusTransitionError,
    InvalidOntologyDefinitionVersionForkError,
    OntologyArtifactPersistError,
    OntologyDefinitionNotFoundError,
    OntologyService,
)
from app.shared.ports.knowledge_graph import KnowledgeGraphPort

router = APIRouter()
DbSession = Annotated[Session, Depends(get_db)]


class SqlAlchemyOntologyTransactionRecorder:
    def __init__(self, session: Session) -> None:
        self._repository = SqlAlchemyAuditTraceRepository(session)

    def record_orchestrated(
        self,
        *,
        transaction_type: str,
        resource_id: str,
        application_id: UUID,
        steps: list[tuple[str, str | None]],
    ) -> UUID:
        return self._repository.record_transaction_with_steps(
            transaction_type=transaction_type,
            resource_type="OntologyDefinition",
            resource_id=resource_id,
            application_id=application_id,
            steps=steps,
        )


class _BoundaryKnowledgeGraphPort:
    """Maps infrastructure import failures to ontology domain errors."""

    def __init__(self, port: KnowledgeGraphPort) -> None:
        self._port = port

    def ping(self) -> dict[str, str]:
        return self._port.ping()

    def import_data(
        self, *, dataset: str, content: str, content_type: str
    ) -> dict[str, str]:
        try:
            return self._port.import_data(
                dataset=dataset,
                content=content,
                content_type=content_type,
            )
        except FusekiImportError as error:
            raise OntologyArtifactPersistError(str(error)) from error


class _SqlAlchemyKnowledgeGraphPortResolver:
    def resolve(self, connector: TechnologyAdapter) -> KnowledgeGraphPort:
        try:
            port = resolve_knowledge_graph_port(connector)
        except UnsupportedKnowledgeGraphVendorError as error:
            raise InvalidOntologyConnectorError(str(error)) from error
        return _BoundaryKnowledgeGraphPort(port)


def _get_service(db: Session) -> OntologyService:
    return OntologyService(
        SqlAlchemyOntologyDefinitionRepository(db),
        SqlAlchemyApplicationRepository(db),
        SqlAlchemyTechnologyAdapterRepository(db),
        SqlAlchemyOntologyTransactionRecorder(db),
        _SqlAlchemyKnowledgeGraphPortResolver(),
    )


@router.post("", response_model=OntologyDefinitionResponse, status_code=status.HTTP_201_CREATED)
def create_ontology(
    payload: OntologyDefinitionCreateRequest, db: DbSession
) -> OntologyDefinitionResponse:
    service = _get_service(db)
    try:
        ontology = service.create_ontology(
            application_id=payload.application_id,
            title=payload.title,
            created_by=payload.created_by,
            description=payload.description,
            ontology_definition=payload.ontology_definition,
            connector_id=payload.connector_id,
        )
    except ApplicationNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    return to_ontology_definition_response(ontology)


@router.post(
    "/import",
    response_model=OntologyDefinitionResponse,
    status_code=status.HTTP_201_CREATED,
)
def import_ontology(
    payload: OntologyDefinitionImportRequest, db: DbSession
) -> OntologyDefinitionResponse:
    service = _get_service(db)
    try:
        ontology, semantic_transaction_id = service.import_ontology(
            application_id=payload.application_id,
            title=payload.title,
            connector_id=payload.connector_id,
            source_format=payload.source_format,
            source_content=payload.source_content,
            created_by=payload.created_by,
            description=payload.description,
        )
    except ApplicationNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except ApplicationWorkspaceNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except ConnectorNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except InvalidOntologyConnectorError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    except OntologyArtifactPersistError as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(error),
        ) from error
    return to_ontology_definition_response(
        ontology, semantic_transaction_id=semantic_transaction_id
    )


@router.get("", response_model=list[OntologyDefinitionResponse])
def list_ontologies(
    db: DbSession,
    application_id: Annotated[UUID, Query()],
    ontology_status: Annotated[OntologyDefinitionStatus | None, Query()] = None,
) -> list[OntologyDefinitionResponse]:
    service = _get_service(db)
    try:
        ontologies = service.list_ontologies(
            application_id=application_id, status=ontology_status
        )
    except ApplicationNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    return [to_ontology_definition_response(item) for item in ontologies]


@router.get("/{ontology_id}", response_model=OntologyDefinitionResponse)
def get_ontology(ontology_id: UUID, db: DbSession) -> OntologyDefinitionResponse:
    service = _get_service(db)
    try:
        ontology = service.get_ontology(ontology_id)
    except OntologyDefinitionNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    return to_ontology_definition_response(ontology)


@router.patch("/{ontology_id}", response_model=OntologyDefinitionResponse)
def update_ontology(
    ontology_id: UUID, payload: OntologyDefinitionUpdateRequest, db: DbSession
) -> OntologyDefinitionResponse:
    service = _get_service(db)
    provided_values = payload.model_dump(exclude_unset=True)
    try:
        ontology = service.update_ontology(
            ontology_id,
            title=provided_values.get("title"),
            description=provided_values.get("description", UNSET),
            ontology_definition=provided_values.get("ontology_definition", UNSET),
        )
    except OntologyDefinitionNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except ImmutableOntologyDefinitionError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    return to_ontology_definition_response(ontology)


@router.patch("/{ontology_id}/status", response_model=OntologyDefinitionResponse)
def update_ontology_status(
    ontology_id: UUID, payload: OntologyDefinitionStatusUpdateRequest, db: DbSession
) -> OntologyDefinitionResponse:
    service = _get_service(db)
    try:
        ontology = service.update_status(ontology_id, status=payload.status)
    except OntologyDefinitionNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except InvalidOntologyDefinitionStatusTransitionError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    return to_ontology_definition_response(ontology)


@router.post(
    "/{ontology_id}/versions",
    response_model=OntologyDefinitionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_ontology_version(
    ontology_id: UUID,
    payload: OntologyDefinitionVersionCreateRequest,
    db: DbSession,
) -> OntologyDefinitionResponse:
    service = _get_service(db)
    try:
        ontology = service.create_version(
            ontology_id,
            ontology_definition=payload.ontology_definition,
        )
    except OntologyDefinitionNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except InvalidOntologyDefinitionVersionForkError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    return to_ontology_definition_response(ontology)

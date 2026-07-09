"""REST routes for ontology-grounded chat (S38-05)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.infrastructure.adapters.llm_resolver import resolve_llm_port
from app.infrastructure.database import get_db
from app.modules.audit_trace.repositories.sqlalchemy_repository import (
    SqlAlchemyAuditTraceRepository,
)
from app.modules.ontology.api.schemas import OntologyChatRequest, OntologyChatResponse
from app.modules.ontology.repositories.sqlalchemy_repository import (
    SqlAlchemyOntologyDefinitionRepository,
)
from app.modules.ontology.services.ontology_chat_service import (
    LLMNotAvailableError,
    OntologyChatService,
    OntologyDefinitionNotFoundError,
)

router = APIRouter()
DbSession = Annotated[Session, Depends(get_db)]


def _get_chat_service(db: Session) -> OntologyChatService:
    return OntologyChatService(
        ontology_repository=SqlAlchemyOntologyDefinitionRepository(db),
        audit_trace_repository=SqlAlchemyAuditTraceRepository(db),
        llm_port=resolve_llm_port(),
        settings=get_settings(),
    )


@router.post("/ontology", response_model=OntologyChatResponse, status_code=status.HTTP_200_OK)
def ask_ontology_question(
    payload: OntologyChatRequest,
    db: DbSession,
) -> OntologyChatResponse:
    service = _get_chat_service(db)
    try:
        result = service.ask_question(
            ontology_id=payload.ontology_id,
            question=payload.question,
            initiated_by=payload.initiated_by,
        )
    except OntologyDefinitionNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except LLMNotAvailableError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(error),
        ) from error

    return OntologyChatResponse(
        semantic_transaction_id=result.semantic_transaction_id,
        status=result.status.value,
        answer=result.answer,
        trace_step_count=result.trace_step_count,
    )

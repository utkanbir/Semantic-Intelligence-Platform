"""Ontology-grounded chat service (S38-05)."""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from app.core.config import Settings, get_settings
from app.modules.audit_trace.domain.enums import (
    SemanticTransactionStatus,
    TraceLayer,
    TraceStepStatus,
)
from app.modules.audit_trace.domain.models import LayeredTraceStepSpec
from app.modules.audit_trace.repositories.sqlalchemy_repository import (
    SqlAlchemyAuditTraceRepository,
)
from app.modules.ontology.repositories.interfaces import OntologyDefinitionRepository
from app.shared.ports.llm import LLMPort

CHAT_TRANSACTION_TYPE = "ontology.question_answered"
CHAT_SYSTEM_PROMPT = (
    "You answer questions using ONLY the supplied ontology structure. "
    "Do not invent classes, properties, or relationships that are not present. "
    "If the structure does not contain enough information, say so clearly."
)


class OntologyDefinitionNotFoundError(Exception):
    """Raised when the target ontology does not exist."""


class LLMNotAvailableError(Exception):
    """Raised when chat cannot call a configured LLM port."""


@dataclass(slots=True)
class OntologyChatResult:
    semantic_transaction_id: UUID
    status: SemanticTransactionStatus
    answer: str
    trace_step_count: int


def format_ontology_context(ontology_definition: dict[str, Any]) -> str:
    """Serialize ontology structure for LLM grounding."""
    classes = ontology_definition.get("classes", [])
    properties = ontology_definition.get("properties", [])
    relationships = ontology_definition.get("relationships", [])
    lines = [
        f"Classes ({len(classes)}):",
    ]
    for item in classes:
        if not isinstance(item, dict):
            continue
        name = item.get("name") or item.get("label") or "unknown"
        label = item.get("label") or ""
        description = item.get("description") or ""
        lines.append(f"- {name} | label={label} | {description}")
    lines.append(f"Properties ({len(properties)}):")
    for item in properties:
        if not isinstance(item, dict):
            continue
        name = item.get("name") or item.get("label") or "unknown"
        domain = item.get("domain") or ""
        datatype = item.get("datatype") or item.get("range") or ""
        description = item.get("description") or ""
        lines.append(f"- {name} | domain={domain} | type={datatype} | {description}")
    lines.append(f"Relationships ({len(relationships)}):")
    for item in relationships:
        if not isinstance(item, dict):
            continue
        name = item.get("name") or item.get("label") or "unknown"
        domain = item.get("domain") or ""
        range_value = item.get("range") or ""
        description = item.get("description") or ""
        lines.append(f"- {name} | {domain} -> {range_value} | {description}")
    return "\n".join(lines)


class OntologyChatService:
    """Ask questions grounded in a single ontology definition."""

    def __init__(
        self,
        *,
        ontology_repository: OntologyDefinitionRepository,
        audit_trace_repository: SqlAlchemyAuditTraceRepository,
        llm_port: LLMPort | None,
        settings: Settings | None = None,
    ) -> None:
        self._ontology_repository = ontology_repository
        self._audit_trace_repository = audit_trace_repository
        self._llm_port = llm_port
        self._settings = settings or get_settings()

    def ask_question(
        self,
        *,
        ontology_id: UUID,
        question: str,
        initiated_by: str | None = None,
    ) -> OntologyChatResult:
        ontology = self._ontology_repository.get(ontology_id)
        if ontology is None:
            raise OntologyDefinitionNotFoundError(f"Ontology {ontology_id} not found")
        if self._llm_port is None:
            raise LLMNotAvailableError("LLM is disabled or not configured for chat")

        participating_assets = {
            "ontology_id": str(ontology.id),
            "ontology_title": ontology.title,
            "llm_provider": self._settings.llm_provider,
        }
        transaction_id = self._audit_trace_repository.begin_semantic_transaction(
            transaction_type=CHAT_TRANSACTION_TYPE,
            resource_type="OntologyDefinition",
            resource_id=str(ontology.id),
            application_id=ontology.application_id,
            initiated_by=initiated_by or "console-user",
            participating_assets=participating_assets,
        )

        step_number = 1
        try:
            step_number = self._record_step(
                transaction_id,
                step_number,
                LayeredTraceStepSpec(
                    step_type="QuestionReceived",
                    layer=TraceLayer.EXPERIENCE,
                    input_summary=f"question={question[:500]}",
                    output_summary="accepted",
                    message="User question received",
                ),
            )

            started = time.perf_counter()
            intent_summary = self._analyze_intent(question)
            step_number = self._record_step(
                transaction_id,
                step_number,
                LayeredTraceStepSpec(
                    step_type="IntentAnalysis",
                    layer=TraceLayer.SEMANTIC,
                    input_summary=f"question={question[:200]}",
                    output_summary=intent_summary,
                    duration_ms=self._elapsed_ms(started),
                    message="Classified question intent",
                ),
            )

            started = time.perf_counter()
            context_text = format_ontology_context(ontology.ontology_definition)
            step_number = self._record_step(
                transaction_id,
                step_number,
                LayeredTraceStepSpec(
                    step_type="OntologyContextRetrieved",
                    layer=TraceLayer.KNOWLEDGE,
                    input_summary=f"ontology_id={ontology.id}",
                    output_summary=f"context_chars={len(context_text)}",
                    duration_ms=self._elapsed_ms(started),
                    message="Loaded ontology structure for grounding",
                ),
            )

            started = time.perf_counter()
            answer = self._llm_port.review_text(
                system_prompt=CHAT_SYSTEM_PROMPT,
                user_prompt=(
                    f"Ontology title: {ontology.title}\n\n"
                    f"{context_text}\n\n"
                    f"Question: {question}"
                ),
            )
            step_number = self._record_step(
                transaction_id,
                step_number,
                LayeredTraceStepSpec(
                    step_type="LLMResponseGenerated",
                    layer=TraceLayer.SEMANTIC,
                    input_summary=f"provider={self._settings.llm_provider}",
                    output_summary=f"answer_chars={len(answer)}",
                    duration_ms=self._elapsed_ms(started),
                    message="Generated grounded answer",
                ),
            )

            step_number = self._record_step(
                transaction_id,
                step_number,
                LayeredTraceStepSpec(
                    step_type="AnswerReturned",
                    layer=TraceLayer.EXPERIENCE,
                    input_summary=f"transaction_id={transaction_id}",
                    output_summary=answer[:500],
                    message="Answer returned to caller",
                ),
            )

            step_number = self._record_step(
                transaction_id,
                step_number,
                LayeredTraceStepSpec(
                    step_type="SemanticTransactionCompleted",
                    layer=TraceLayer.SEMANTIC,
                    input_summary=f"transaction_id={transaction_id}",
                    output_summary="status=Completed",
                    message="Ontology chat transaction completed",
                ),
            )
            self._audit_trace_repository.finalize_semantic_transaction(
                transaction_id,
                status=SemanticTransactionStatus.COMPLETED,
            )
            return OntologyChatResult(
                semantic_transaction_id=transaction_id,
                status=SemanticTransactionStatus.COMPLETED,
                answer=answer,
                trace_step_count=step_number - 1,
            )
        except Exception as error:
            self._record_step(
                transaction_id,
                step_number,
                LayeredTraceStepSpec(
                    step_type="SemanticTransactionFailed",
                    layer=TraceLayer.SEMANTIC,
                    status=TraceStepStatus.FAILED,
                    input_summary=f"transaction_id={transaction_id}",
                    output_summary=str(error)[:500],
                    message="Ontology chat transaction failed",
                ),
            )
            self._audit_trace_repository.finalize_semantic_transaction(
                transaction_id,
                status=SemanticTransactionStatus.FAILED,
            )
            raise

    def _record_step(
        self,
        transaction_id: UUID,
        step_number: int,
        spec: LayeredTraceStepSpec,
    ) -> int:
        self._audit_trace_repository.append_layered_step(
            transaction_id,
            step_number=step_number,
            spec=spec,
        )
        return step_number + 1

    @staticmethod
    def _elapsed_ms(started: float) -> int:
        return int((time.perf_counter() - started) * 1000)

    @staticmethod
    def _analyze_intent(question: str) -> str:
        normalized = question.strip().lower()
        if normalized.startswith(("what is", "what are", "define")):
            return "intent=definition_lookup"
        if normalized.startswith(("how many", "list", "show")):
            return "intent=inventory_lookup"
        if "relate" in normalized or "relationship" in normalized:
            return "intent=relationship_lookup"
        return "intent=general_ontology_query"

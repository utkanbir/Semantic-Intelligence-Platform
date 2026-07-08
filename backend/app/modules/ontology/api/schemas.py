"""Pydantic request/response schemas for the ontology module."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Self
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from app.modules.ontology.domain.enums import OntologyDefinitionStatus
from app.modules.ontology.domain.extraction import ExtractionResult, ExtractionSource
from app.modules.ontology.domain.models import OntologyDefinition
from app.modules.ontology.domain.semantic_review import SemanticReviewResult
from app.modules.ontology.domain.validation import OntologyValidationReport


class ValidationFindingResponse(BaseModel):
    level: str
    code: str
    message: str


class OntologyClassSummaryResponse(BaseModel):
    uri: str
    label: str | None = None
    local_name: str


class OntologyRelationSummaryResponse(BaseModel):
    uri: str
    label: str | None = None
    local_name: str
    property_type: str
    domain: str | None = None
    range: str | None = None


class OntologyValidationInventoryResponse(BaseModel):
    classes: list[OntologyClassSummaryResponse]
    relations: list[OntologyRelationSummaryResponse]
    truncated: bool


class OntologyValidationReportResponse(BaseModel):
    passed: bool
    error_count: int
    warning_count: int
    findings: list[ValidationFindingResponse]
    stats: dict[str, int]
    run_at: datetime
    run_id: UUID
    ai_summary: str | None = None
    inventory: OntologyValidationInventoryResponse | None = None


class OntologyDefinitionResponse(BaseModel):
    id: UUID
    application_id: UUID
    version_number: int
    previous_version_id: UUID | None = None
    status: OntologyDefinitionStatus
    title: str
    description: str | None = None
    created_by: str
    created_at: datetime
    updated_at: datetime
    validated_at: datetime | None = None
    approved_at: datetime | None = None
    published_at: datetime | None = None
    version_created_at: datetime | None = None
    ontology_definition: dict[str, Any]
    connector_id: UUID | None = None
    artifact_uri: str | None = None
    source_format: str | None = None
    semantic_transaction_id: UUID | None = None


class OntologyDefinitionCreateRequest(BaseModel):
    application_id: UUID
    title: str = Field(min_length=1, max_length=255)
    created_by: str | None = Field(default=None, max_length=255)
    description: str | None = None
    ontology_definition: dict[str, Any] | None = None
    connector_id: UUID | None = None


class OntologyDefinitionImportRequest(BaseModel):
    application_id: UUID
    title: str = Field(min_length=1, max_length=255)
    connector_id: UUID
    source_format: str = Field(min_length=1, max_length=50)
    source_content: str = Field(min_length=1)
    created_by: str | None = Field(default=None, max_length=255)
    description: str | None = None


class OntologyContentValidateRequest(BaseModel):
    source_format: str = Field(min_length=1, max_length=50)
    source_content: str = Field(min_length=1)
    title: str | None = Field(default=None, max_length=255)
    description: str | None = None
    application_id: UUID | None = None


class OntologyDefinitionUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    ontology_definition: dict[str, Any] | None = None


class OntologyDefinitionStatusUpdateRequest(BaseModel):
    status: OntologyDefinitionStatus


class OntologyConnectorSelectRequest(BaseModel):
    connector_id: UUID


class OntologyDefinitionVersionCreateRequest(BaseModel):
    ontology_definition: dict[str, Any] | None = None


class SemanticReviewFindingResponse(BaseModel):
    id: str
    kind: str
    title: str
    detail: str
    target: str | None = None
    decision: str | None = None


class OntologySemanticReviewResponse(BaseModel):
    available: bool
    reviewed_at: datetime
    review_id: UUID
    model: str | None = None
    summary: str | None = None
    findings: list[SemanticReviewFindingResponse]


class OntologyValidationRunResponse(BaseModel):
    ontology: OntologyDefinitionResponse
    report: OntologyValidationReportResponse
    semantic_review: OntologySemanticReviewResponse
    semantic_transaction_id: UUID | None = None


class SuggestionDecisionRequest(BaseModel):
    decision: Literal["accepted", "ignored"]


class OntologySuggestionDecisionResponse(BaseModel):
    ontology: OntologyDefinitionResponse
    semantic_review: OntologySemanticReviewResponse
    semantic_transaction_id: UUID | None = None


class OntologyGenerationSourceRequest(BaseModel):
    kind: Literal["file", "paste", "knowledge_source", "url"]
    content: str = Field(default="")
    url: str | None = Field(default=None, max_length=2048)
    name: str | None = Field(default=None, max_length=255)
    reference_id: str | None = Field(default=None, max_length=255)

    @model_validator(mode="after")
    def validate_source_fields(self) -> Self:
        if self.kind == "url":
            if not self.url or not self.url.strip():
                raise ValueError("url is required when kind is url")
        elif not self.content or not self.content.strip():
            raise ValueError("content is required when kind is not url")
        return self


class OntologyGenerateRequest(BaseModel):
    application_id: UUID
    title: str = Field(min_length=1, max_length=255)
    sources: list[OntologyGenerationSourceRequest] = Field(min_length=1)
    created_by: str | None = Field(default=None, max_length=255)
    description: str | None = None


class CandidateEvidenceResponse(BaseModel):
    snippet: str
    source_ref: str | None = None


class ClassCandidateResponse(BaseModel):
    name: str
    label: str | None = None
    description: str | None = None
    evidence: list[CandidateEvidenceResponse]


class PropertyCandidateResponse(BaseModel):
    name: str
    label: str | None = None
    domain: str | None = None
    datatype: str | None = None
    description: str | None = None
    evidence: list[CandidateEvidenceResponse]


class RelationshipCandidateResponse(BaseModel):
    name: str
    label: str | None = None
    domain: str | None = None
    range: str | None = None
    description: str | None = None
    evidence: list[CandidateEvidenceResponse]


class ExtractionSourceResponse(BaseModel):
    kind: str
    name: str | None = None
    reference_id: str | None = None
    url: str | None = None
    content_length: int


class OntologyExtractionResponse(BaseModel):
    available: bool
    extracted_at: datetime
    extraction_id: UUID
    model: str | None = None
    summary: str | None = None
    classes: list[ClassCandidateResponse]
    properties: list[PropertyCandidateResponse]
    relationships: list[RelationshipCandidateResponse]
    sources: list[ExtractionSourceResponse]


class OntologyGenerateResponse(BaseModel):
    ontology: OntologyDefinitionResponse
    extraction: OntologyExtractionResponse
    semantic_transaction_id: UUID | None = None


def to_extraction_source_domain(
    source: OntologyGenerationSourceRequest,
) -> ExtractionSource:
    return ExtractionSource(
        kind=source.kind,
        content=source.content,
        name=source.name,
        reference_id=source.reference_id,
        url=source.url.strip() if source.url else None,
    )


def to_ontology_extraction_response(
    extraction: ExtractionResult,
) -> OntologyExtractionResponse:
    return OntologyExtractionResponse(
        available=extraction.available,
        extracted_at=extraction.extracted_at,
        extraction_id=extraction.extraction_id,
        model=extraction.model,
        summary=extraction.summary,
        classes=[
            ClassCandidateResponse(
                name=item.name,
                label=item.label,
                description=item.description,
                evidence=[
                    CandidateEvidenceResponse(
                        snippet=evidence.snippet, source_ref=evidence.source_ref
                    )
                    for evidence in item.evidence
                ],
            )
            for item in extraction.classes
        ],
        properties=[
            PropertyCandidateResponse(
                name=item.name,
                label=item.label,
                domain=item.domain,
                datatype=item.datatype,
                description=item.description,
                evidence=[
                    CandidateEvidenceResponse(
                        snippet=evidence.snippet, source_ref=evidence.source_ref
                    )
                    for evidence in item.evidence
                ],
            )
            for item in extraction.properties
        ],
        relationships=[
            RelationshipCandidateResponse(
                name=item.name,
                label=item.label,
                domain=item.domain,
                range=item.range,
                description=item.description,
                evidence=[
                    CandidateEvidenceResponse(
                        snippet=evidence.snippet, source_ref=evidence.source_ref
                    )
                    for evidence in item.evidence
                ],
            )
            for item in extraction.relationships
        ],
        sources=[
            ExtractionSourceResponse(
                kind=source.kind,
                name=source.name,
                reference_id=source.reference_id,
                url=source.url,
                content_length=len(source.content),
            )
            for source in extraction.sources
        ],
    )


def to_ontology_validation_report_response(
    report: OntologyValidationReport,
) -> OntologyValidationReportResponse:
    inventory = None
    if report.inventory is not None:
        inventory = OntologyValidationInventoryResponse(
            classes=[
                OntologyClassSummaryResponse(
                    uri=item.uri,
                    label=item.label,
                    local_name=item.local_name,
                )
                for item in report.inventory.classes
            ],
            relations=[
                OntologyRelationSummaryResponse(
                    uri=item.uri,
                    label=item.label,
                    local_name=item.local_name,
                    property_type=item.property_type,
                    domain=item.domain,
                    range=item.range,
                )
                for item in report.inventory.relations
            ],
            truncated=report.inventory.truncated,
        )

    return OntologyValidationReportResponse(
        passed=report.passed,
        error_count=report.error_count,
        warning_count=report.warning_count,
        findings=[
            ValidationFindingResponse(
                level=finding.level,
                code=finding.code,
                message=finding.message,
            )
            for finding in report.findings
        ],
        stats=report.stats,
        run_at=report.run_at,
        run_id=report.run_id,
        ai_summary=report.ai_summary,
        inventory=inventory,
    )


def to_semantic_review_response(
    review: SemanticReviewResult,
) -> OntologySemanticReviewResponse:
    return OntologySemanticReviewResponse(
        available=review.available,
        reviewed_at=review.reviewed_at,
        review_id=review.review_id,
        model=review.model,
        summary=review.summary,
        findings=[
            SemanticReviewFindingResponse(
                id=finding.id,
                kind=finding.kind,
                title=finding.title,
                detail=finding.detail,
                target=finding.target,
                decision=finding.decision,
            )
            for finding in review.findings
        ],
    )


def to_ontology_definition_response(
    ontology: OntologyDefinition,
    *,
    semantic_transaction_id: UUID | None = None,
) -> OntologyDefinitionResponse:
    return OntologyDefinitionResponse(
        id=ontology.id,
        application_id=ontology.application_id,
        version_number=ontology.version_number,
        previous_version_id=ontology.previous_version_id,
        status=ontology.status,
        title=ontology.title,
        description=ontology.description,
        created_by=ontology.created_by,
        created_at=ontology.created_at,
        updated_at=ontology.updated_at,
        validated_at=ontology.validated_at,
        approved_at=ontology.approved_at,
        published_at=ontology.published_at,
        version_created_at=ontology.version_created_at,
        ontology_definition=ontology.ontology_definition,
        connector_id=ontology.connector_id,
        artifact_uri=ontology.artifact_uri,
        source_format=ontology.source_format,
        semantic_transaction_id=semantic_transaction_id,
    )

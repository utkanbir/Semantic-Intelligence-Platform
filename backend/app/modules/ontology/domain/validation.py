"""Domain models for ontology validation reports."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal
from uuid import UUID

ValidationLevel = Literal["error", "warning", "info"]


@dataclass(slots=True)
class ValidationFinding:
    level: ValidationLevel
    code: str
    message: str

    def to_dict(self) -> dict[str, str]:
        return {"level": self.level, "code": self.code, "message": self.message}


@dataclass(slots=True)
class OntologyValidationReport:
    passed: bool
    error_count: int
    warning_count: int
    findings: list[ValidationFinding]
    stats: dict[str, int]
    run_at: datetime
    run_id: UUID
    ai_summary: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "passed": self.passed,
            "error_count": self.error_count,
            "warning_count": self.warning_count,
            "findings": [finding.to_dict() for finding in self.findings],
            "stats": self.stats,
            "run_at": self.run_at.isoformat(),
            "run_id": str(self.run_id),
            "ai_summary": self.ai_summary,
        }

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> OntologyValidationReport | None:
        if not payload:
            return None
        try:
            run_id = UUID(str(payload["run_id"]))
            run_at = datetime.fromisoformat(str(payload["run_at"]))
        except (KeyError, TypeError, ValueError):
            return None

        findings: list[ValidationFinding] = []
        for item in payload.get("findings", []):
            if not isinstance(item, dict):
                continue
            level = item.get("level")
            code = item.get("code")
            message = item.get("message")
            if level in {"error", "warning", "info"} and isinstance(code, str) and isinstance(
                message, str
            ):
                findings.append(ValidationFinding(level=level, code=code, message=message))

        stats = payload.get("stats")
        if not isinstance(stats, dict):
            stats = {}

        normalized_stats = {str(key): int(value) for key, value in stats.items()}

        return cls(
            passed=bool(payload.get("passed")),
            error_count=int(payload.get("error_count", 0)),
            warning_count=int(payload.get("warning_count", 0)),
            findings=findings,
            stats=normalized_stats,
            run_at=run_at,
            run_id=run_id,
            ai_summary=(
                str(payload["ai_summary"]) if payload.get("ai_summary") is not None else None
            ),
        )


def read_stored_validation_report(
    ontology_definition: dict[str, Any],
) -> OntologyValidationReport | None:
    metadata = ontology_definition.get("metadata")
    if not isinstance(metadata, dict):
        return None
    validation = metadata.get("validation")
    if not isinstance(validation, dict):
        return None
    return OntologyValidationReport.from_dict(validation)


def attach_validation_report(
    ontology_definition: dict[str, Any], report: OntologyValidationReport
) -> dict[str, Any]:
    definition = dict(ontology_definition)
    metadata = dict(definition.get("metadata", {}))
    metadata["validation"] = report.to_dict()
    definition["metadata"] = metadata
    return definition

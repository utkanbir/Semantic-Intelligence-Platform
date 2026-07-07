"""Application services for the ontology module."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, cast
from uuid import UUID, uuid4

from app.modules.adapters.domain.enums import ConnectorType, TechnologyAdapterStatus
from app.modules.adapters.domain.models import TechnologyAdapter
from app.modules.adapters.repositories.interfaces import TechnologyAdapterRepository
from app.modules.applications.repositories.interfaces import ApplicationRepository
from app.modules.ontology.domain.enums import OntologyDefinitionStatus
from app.modules.ontology.domain.models import OntologyDefinition
from app.modules.ontology.domain.validation import (
    OntologyValidationReport,
    attach_validation_report,
    read_stored_validation_report,
)
from app.modules.ontology.ports.interfaces import (
    KnowledgeGraphPortResolver,
    OntologyTransactionRecorder,
)
from app.modules.ontology.repositories.interfaces import OntologyDefinitionRepository
from app.modules.ontology.services.ontology_validation_service import OntologyValidationService
from app.modules.ontology.services.rdf_formats import resolve_rdf_content_type
from app.shared.ports.knowledge_graph import KnowledgeGraphPort

UNSET = object()

DEFAULT_ONTOLOGY_DEFINITION: dict[str, Any] = {
    "schema_version": "1",
    "classes": [],
    "properties": [],
    "relationships": [],
    "metadata": {},
}


def ontology_fuseki_graph_uri(ontology_id: UUID) -> str:
    """Stable named graph IRI for an ontology artifact in Fuseki."""
    return f"urn:sip:ontology:{ontology_id}"


class ApplicationNotFoundError(Exception):
    """Raised when the parent application does not exist."""


class OntologyDefinitionNotFoundError(Exception):
    """Raised when an ontology definition cannot be found."""


class ImmutableOntologyDefinitionError(Exception):
    """Raised when mutating a locked ontology definition."""


class InvalidOntologyDefinitionStatusTransitionError(Exception):
    """Raised when an ontology status transition is not allowed."""


class InvalidOntologyDefinitionVersionForkError(Exception):
    """Raised when an ontology version fork is not allowed."""


class ConnectorNotFoundError(Exception):
    """Raised when the selected connector does not exist."""


class InvalidOntologyConnectorError(Exception):
    """Raised when the connector is not eligible for ontology import."""


class OntologyArtifactPersistError(Exception):
    """Raised when ontology artifact persistence to the knowledge graph fails."""


class OntologyValidationFailedError(Exception):
    """Raised when ontology structural validation fails."""


class OntologyValidationRequiredError(Exception):
    """Raised when lifecycle transition requires a passing validation report."""


class OntologyMaterializationNotAllowedError(Exception):
    """Raised when ontology materialization preconditions are not met."""


class OntologyAlreadyMaterializedError(Exception):
    """Raised when materialize is requested for an ontology with an artifact."""


class ApplicationWorkspaceNotFoundError(Exception):
    """Raised when the application workspace is unavailable for import."""


class _NoOpTransactionRecorder:
    def record_orchestrated(
        self,
        *,
        transaction_type: str,
        resource_id: str,
        application_id: UUID,
        steps: list[tuple[str, str | None]],
    ) -> UUID | None:
        return None


class _NoOpKnowledgeGraphPortResolver:
    def resolve(self, connector: TechnologyAdapter) -> KnowledgeGraphPort:
        raise InvalidOntologyConnectorError("Knowledge graph port resolver unavailable")


class OntologyService:
    """Ontology definition CRUD, import, and lifecycle orchestration."""

    def __init__(
        self,
        repository: OntologyDefinitionRepository,
        application_repository: ApplicationRepository,
        connector_repository: TechnologyAdapterRepository | None = None,
        transaction_recorder: OntologyTransactionRecorder | None = None,
        knowledge_graph_port_resolver: KnowledgeGraphPortResolver | None = None,
        validation_service: OntologyValidationService | None = None,
    ) -> None:
        self._repository = repository
        self._application_repository = application_repository
        self._connector_repository = connector_repository
        self._transaction_recorder = transaction_recorder or _NoOpTransactionRecorder()
        self._knowledge_graph_port_resolver = (
            knowledge_graph_port_resolver or _NoOpKnowledgeGraphPortResolver()
        )
        self._validation_service = validation_service or OntologyValidationService()

    def create_ontology(
        self,
        *,
        application_id: UUID,
        title: str,
        created_by: str | None = None,
        description: str | None = None,
        ontology_definition: dict[str, Any] | None = None,
        connector_id: UUID | None = None,
    ) -> OntologyDefinition:
        if self._application_repository.get(application_id) is None:
            raise ApplicationNotFoundError("Application not found")

        now = datetime.now(UTC)
        definition = (
            dict(DEFAULT_ONTOLOGY_DEFINITION)
            if ontology_definition is None
            else ontology_definition
        )
        ontology = OntologyDefinition(
            id=uuid4(),
            application_id=application_id,
            version_number=1,
            status=OntologyDefinitionStatus.DRAFT,
            title=title,
            description=description,
            created_by=created_by or "",
            created_at=now,
            updated_at=now,
            ontology_definition=definition,
            connector_id=connector_id,
        )
        created = self._repository.create(ontology)
        self._record_transaction(
            transaction_type="ontology.created",
            ontology=created,
            steps=[
                ("validate_request", "Validated ontology create request"),
                ("persist_metadata", "Persisted ontology metadata"),
                ("finalize", "Ontology create completed"),
            ],
        )
        return created

    def import_ontology(
        self,
        *,
        application_id: UUID,
        title: str,
        connector_id: UUID,
        source_format: str,
        source_content: str,
        created_by: str | None = None,
        description: str | None = None,
    ) -> tuple[OntologyDefinition, UUID | None]:
        application = self._application_repository.get(application_id)
        if application is None:
            raise ApplicationNotFoundError("Application not found")
        connector = self._require_ontology_connector(connector_id)

        now = datetime.now(UTC)
        ontology_id = uuid4()
        fuseki_graph_uri = ontology_fuseki_graph_uri(ontology_id)

        validation_report = self._validation_service.validate_content(
            source_content=source_content,
            source_format=source_format,
            title=title,
            description=description,
        )
        if not validation_report.passed:
            raise OntologyValidationFailedError(_format_validation_failure(validation_report))

        definition = dict(DEFAULT_ONTOLOGY_DEFINITION)
        definition["metadata"] = {
            **definition.get("metadata", {}),
            "import": {
                "source_format": source_format,
                "content_length": len(source_content),
                "source_content": source_content,
                "fuseki_graph_uri": fuseki_graph_uri,
            },
            "validation": validation_report.to_dict(),
        }
        ontology = OntologyDefinition(
            id=ontology_id,
            application_id=application_id,
            version_number=1,
            status=OntologyDefinitionStatus.DRAFT,
            title=title,
            description=description,
            created_by=created_by or "",
            created_at=now,
            updated_at=now,
            ontology_definition=definition,
            connector_id=connector_id,
            artifact_uri=None,
            source_format=source_format,
        )
        created = self._repository.create(ontology)
        semantic_transaction_id = self._record_transaction(
            transaction_type="ontology.imported",
            ontology=created,
            steps=[
                ("validate_request", "Validated ontology import request"),
                ("resolve_connector", f"Resolved connector {connector.adapter_key}"),
                ("persist_metadata", "Persisted ontology metadata"),
                ("finalize", "Ontology import completed"),
            ],
        )
        return created, semantic_transaction_id

    def materialize_ontology(
        self, ontology_id: UUID
    ) -> tuple[OntologyDefinition, UUID | None]:
        current = self._repository.get(ontology_id)
        if current is None:
            raise OntologyDefinitionNotFoundError("Ontology definition not found")
        if current.status != OntologyDefinitionStatus.APPROVED:
            raise OntologyMaterializationNotAllowedError(
                "Materialize requires Approved status"
            )
        if current.artifact_uri is not None:
            raise OntologyAlreadyMaterializedError("Ontology artifact already materialized")
        if current.connector_id is None:
            raise InvalidOntologyConnectorError("Connector is required for materialize")

        report = read_stored_validation_report(current.ontology_definition)
        if report is None:
            raise OntologyValidationRequiredError(
                "Run validation and resolve all errors before materialize"
            )
        if not report.passed:
            raise OntologyValidationRequiredError(
                "Validation report contains errors; resolve them before materialize"
            )

        source_content = self._read_stored_source_content(current)
        if source_content is None:
            raise OntologyValidationRequiredError(
                "No import source content available for materialize"
            )

        application = self._application_repository.get(current.application_id)
        if application is None:
            raise ApplicationNotFoundError("Application not found")
        workspace = application.workspace
        if workspace is None or not workspace.fuseki_dataset:
            raise ApplicationWorkspaceNotFoundError(
                "Application workspace fuseki_dataset unavailable"
            )

        connector = self._require_ontology_connector(current.connector_id)
        source_format = current.source_format or "ttl"
        fuseki_graph_uri = self._read_fuseki_graph_uri(current) or ontology_fuseki_graph_uri(
            current.id
        )
        content_type = resolve_rdf_content_type(source_format, source_content)
        knowledge_graph = self._knowledge_graph_port_resolver.resolve(connector)
        import_result = knowledge_graph.import_data(
            dataset=workspace.fuseki_dataset,
            content=source_content,
            content_type=content_type,
            graph=fuseki_graph_uri,
        )

        artifact_uri = (
            f"fuseki://{workspace.fuseki_dataset}/ontologies/{current.id}/"
            f"artifact.{source_format.lstrip('.')}"
        )
        definition = dict(current.ontology_definition)
        metadata = dict(definition.get("metadata", {}))
        import_meta = dict(metadata.get("import", {}))
        import_meta["fuseki_dataset"] = workspace.fuseki_dataset
        import_meta["fuseki_graph_uri"] = fuseki_graph_uri
        import_meta["fuseki_location"] = import_result.get("location")
        metadata["import"] = import_meta
        definition["metadata"] = metadata

        updated = OntologyDefinition(
            id=current.id,
            application_id=current.application_id,
            version_number=current.version_number,
            previous_version_id=current.previous_version_id,
            status=current.status,
            title=current.title,
            description=current.description,
            created_by=current.created_by,
            created_at=current.created_at,
            updated_at=datetime.now(UTC),
            validated_at=current.validated_at,
            approved_at=current.approved_at,
            published_at=current.published_at,
            version_created_at=current.version_created_at,
            ontology_definition=definition,
            connector_id=current.connector_id,
            artifact_uri=artifact_uri,
            source_format=current.source_format,
        )
        result = self._repository.update(updated)
        if result is None:
            raise OntologyDefinitionNotFoundError("Ontology definition not found")

        persist_location = import_result.get("location", artifact_uri)
        steps: list[tuple[str, str | None]] = [
            ("ConnectorSelected", f"Selected connector {connector.adapter_key}"),
        ]
        if current.approved_at is not None:
            steps.append(
                (
                    "OntologyApproved",
                    f"Ontology approved at {current.approved_at.isoformat()}",
                )
            )
        else:
            steps.append(("OntologyApproved", "Ontology approved for materialization"))
        steps.extend(
            [
                ("OntologyMaterialized", f"Materialized to graph {fuseki_graph_uri}"),
                ("persist_artifact", f"Artifact persisted at {persist_location}"),
            ]
        )
        semantic_transaction_id = self._record_transaction(
            transaction_type="ontology.materialized",
            ontology=result,
            steps=steps,
        )
        return result, semantic_transaction_id

    def validate_content(
        self,
        *,
        source_format: str,
        source_content: str,
        title: str | None = None,
        description: str | None = None,
    ) -> OntologyValidationReport:
        return self._validation_service.validate_content(
            source_content=source_content,
            source_format=source_format,
            title=title,
            description=description,
        )

    def run_validation(
        self, ontology_id: UUID
    ) -> tuple[OntologyDefinition, OntologyValidationReport, UUID | None]:
        current = self._repository.get(ontology_id)
        if current is None:
            raise OntologyDefinitionNotFoundError("Ontology definition not found")
        if current.status != OntologyDefinitionStatus.DRAFT:
            raise InvalidOntologyDefinitionStatusTransitionError(
                "Validation runs are only supported for Draft ontologies"
            )

        source_format = current.source_format or "ttl"
        source_content = self._resolve_validation_content(current)
        report = self._validation_service.validate_content(
            source_content=source_content,
            source_format=source_format,
            title=current.title,
            description=current.description,
            ontology_definition=current.ontology_definition,
        )

        updated_definition = attach_validation_report(current.ontology_definition, report)
        updated = OntologyDefinition(
            id=current.id,
            application_id=current.application_id,
            version_number=current.version_number,
            previous_version_id=current.previous_version_id,
            status=current.status,
            title=current.title,
            description=current.description,
            created_by=current.created_by,
            created_at=current.created_at,
            updated_at=datetime.now(UTC),
            validated_at=current.validated_at,
            approved_at=current.approved_at,
            published_at=current.published_at,
            version_created_at=current.version_created_at,
            ontology_definition=updated_definition,
            connector_id=current.connector_id,
            artifact_uri=current.artifact_uri,
            source_format=current.source_format,
        )
        result = self._repository.update(updated)
        if result is None:
            raise OntologyDefinitionNotFoundError("Ontology definition not found")

        semantic_transaction_id = self._record_transaction(
            transaction_type="ontology.validation_run",
            ontology=result,
            steps=[
                (
                    "validate_structure",
                    f"Structural validation {'passed' if report.passed else 'failed'}",
                ),
                (
                    "summarize_findings",
                    f"{report.error_count} errors, {report.warning_count} warnings",
                ),
                ("finalize", "Ontology validation run completed"),
            ],
        )
        return result, report, semantic_transaction_id

    def _resolve_validation_content(self, ontology: OntologyDefinition) -> str:
        metadata = ontology.ontology_definition.get("metadata", {})
        if isinstance(metadata, dict):
            import_meta = metadata.get("import")
            if isinstance(import_meta, dict):
                stored_content = import_meta.get("source_content")
                if isinstance(stored_content, str) and stored_content.strip():
                    return stored_content

        if ontology.artifact_uri and ontology.connector_id:
            application = self._application_repository.get(ontology.application_id)
            if application is None or application.workspace is None:
                raise ApplicationWorkspaceNotFoundError(
                    "Application workspace unavailable for validation export"
                )
            connector = self._require_ontology_connector(ontology.connector_id)
            knowledge_graph = self._knowledge_graph_port_resolver.resolve(connector)
            source_format = ontology.source_format or "ttl"
            accept_format = resolve_rdf_content_type(source_format)
            graph_uri = self._read_fuseki_graph_uri(ontology)
            return knowledge_graph.export_data(
                dataset=application.workspace.fuseki_dataset,
                accept_format=accept_format,
                graph=graph_uri,
            )

        if isinstance(metadata, dict):
            import_meta = metadata.get("import")
            if isinstance(import_meta, dict):
                raise OntologyValidationRequiredError(
                    "No materialized artifact available for validation export"
                )

        raise OntologyValidationRequiredError(
            "Ontology has no import artifact to validate"
        )

    def _require_passing_validation_report(self, ontology: OntologyDefinition) -> None:
        has_import_content = self._read_stored_source_content(ontology) is not None
        if ontology.artifact_uri is None and not has_import_content:
            return

        report = read_stored_validation_report(ontology.ontology_definition)
        if report is None:
            raise OntologyValidationRequiredError(
                "Run validation and resolve all errors before marking Validated"
            )
        if not report.passed:
            raise OntologyValidationRequiredError(
                "Validation report contains errors; resolve them before marking Validated"
            )

    def list_ontologies(
        self,
        *,
        application_id: UUID,
        status: OntologyDefinitionStatus | None = None,
    ) -> list[OntologyDefinition]:
        if self._application_repository.get(application_id) is None:
            raise ApplicationNotFoundError("Application not found")
        status_value = status.value if status is not None else None
        return list(self._repository.list_by_application(application_id, status=status_value))

    def get_ontology(self, ontology_id: UUID) -> OntologyDefinition:
        ontology = self._repository.get(ontology_id)
        if ontology is None:
            raise OntologyDefinitionNotFoundError("Ontology definition not found")
        return ontology

    def delete_ontology(self, ontology_id: UUID) -> None:
        current = self._repository.get(ontology_id)
        if current is None:
            raise OntologyDefinitionNotFoundError("Ontology definition not found")

        self._remove_fuseki_artifact(current)

        deleted = self._repository.delete(ontology_id)
        if not deleted:
            raise OntologyDefinitionNotFoundError("Ontology definition not found")

    def _read_fuseki_graph_uri(self, ontology: OntologyDefinition) -> str | None:
        metadata = ontology.ontology_definition.get("metadata", {})
        if isinstance(metadata, dict):
            import_meta = metadata.get("import")
            if isinstance(import_meta, dict):
                graph_uri = import_meta.get("fuseki_graph_uri")
                if isinstance(graph_uri, str) and graph_uri.strip():
                    return graph_uri
        return None

    def _read_stored_source_content(self, ontology: OntologyDefinition) -> str | None:
        metadata = ontology.ontology_definition.get("metadata", {})
        if isinstance(metadata, dict):
            import_meta = metadata.get("import")
            if isinstance(import_meta, dict):
                source_content = import_meta.get("source_content")
                if isinstance(source_content, str) and source_content.strip():
                    return source_content
        return None

    def _remove_fuseki_artifact(self, ontology: OntologyDefinition) -> None:
        if ontology.artifact_uri is None or ontology.connector_id is None:
            return

        application = self._application_repository.get(ontology.application_id)
        if application is None or application.workspace is None:
            return

        try:
            connector = self._require_ontology_connector(ontology.connector_id)
            knowledge_graph = self._knowledge_graph_port_resolver.resolve(connector)
        except (ConnectorNotFoundError, InvalidOntologyConnectorError):
            return

        dataset = application.workspace.fuseki_dataset
        graph_uri = self._read_fuseki_graph_uri(ontology)
        if graph_uri:
            knowledge_graph.delete_graph(dataset=dataset, graph=graph_uri)
            return

        source_content = self._read_stored_source_content(ontology)
        if source_content is None:
            return

        source_format = ontology.source_format or "ttl"
        content_type = resolve_rdf_content_type(source_format, source_content)
        knowledge_graph.delete_default_graph_content(
            dataset=dataset,
            content=source_content,
            content_type=content_type,
        )

    def update_ontology(
        self,
        ontology_id: UUID,
        *,
        title: str | None = None,
        description: str | None | object = UNSET,
        ontology_definition: dict[str, Any] | None | object = UNSET,
    ) -> OntologyDefinition:
        current = self._repository.get(ontology_id)
        if current is None:
            raise OntologyDefinitionNotFoundError("Ontology definition not found")
        if current.status in {
            OntologyDefinitionStatus.VERSIONED,
            OntologyDefinitionStatus.RETIRED,
        }:
            raise ImmutableOntologyDefinitionError(
                "Ontology definition is immutable in current status"
            )

        updated = OntologyDefinition(
            id=current.id,
            application_id=current.application_id,
            version_number=current.version_number,
            previous_version_id=current.previous_version_id,
            status=current.status,
            title=title if title is not None else current.title,
            description=(
                current.description if description is UNSET else cast(str | None, description)
            ),
            created_by=current.created_by,
            created_at=current.created_at,
            updated_at=datetime.now(UTC),
            validated_at=current.validated_at,
            approved_at=current.approved_at,
            published_at=current.published_at,
            version_created_at=current.version_created_at,
            ontology_definition=(
                current.ontology_definition
                if ontology_definition is UNSET
                else cast(dict[str, Any], ontology_definition)
            ),
            connector_id=current.connector_id,
            artifact_uri=current.artifact_uri,
            source_format=current.source_format,
        )
        result = self._repository.update(updated)
        if result is None:
            raise OntologyDefinitionNotFoundError("Ontology definition not found")
        self._record_transaction(
            transaction_type="ontology.updated",
            ontology=result,
            steps=[
                ("validate_request", "Validated ontology update request"),
                ("persist_metadata", "Updated ontology metadata"),
                ("finalize", "Ontology update completed"),
            ],
        )
        return result

    def update_status(
        self, ontology_id: UUID, *, status: OntologyDefinitionStatus
    ) -> OntologyDefinition:
        current = self._repository.get(ontology_id)
        if current is None:
            raise OntologyDefinitionNotFoundError("Ontology definition not found")
        if not _is_valid_status_transition(current.status, status):
            raise InvalidOntologyDefinitionStatusTransitionError(
                f"Invalid status transition: {current.status.value} -> {status.value}"
            )

        if status == OntologyDefinitionStatus.VALIDATED:
            self._require_passing_validation_report(current)

        validated_at = current.validated_at
        if status == OntologyDefinitionStatus.VALIDATED and validated_at is None:
            validated_at = datetime.now(UTC)

        approved_at = current.approved_at
        if status == OntologyDefinitionStatus.APPROVED and approved_at is None:
            approved_at = datetime.now(UTC)

        published_at = current.published_at
        if status == OntologyDefinitionStatus.PUBLISHED and published_at is None:
            published_at = datetime.now(UTC)

        updated = OntologyDefinition(
            id=current.id,
            application_id=current.application_id,
            version_number=current.version_number,
            previous_version_id=current.previous_version_id,
            status=status,
            title=current.title,
            description=current.description,
            created_by=current.created_by,
            created_at=current.created_at,
            updated_at=datetime.now(UTC),
            validated_at=validated_at,
            approved_at=approved_at,
            published_at=published_at,
            version_created_at=current.version_created_at,
            ontology_definition=current.ontology_definition,
            connector_id=current.connector_id,
            artifact_uri=current.artifact_uri,
            source_format=current.source_format,
        )
        result = self._repository.update(updated)
        if result is None:
            raise OntologyDefinitionNotFoundError("Ontology definition not found")
        self._record_transaction(
            transaction_type="ontology.status_changed",
            ontology=result,
            steps=[
                (
                    "transition_status",
                    f"Status changed to {status.value}",
                ),
                ("finalize", "Ontology status transition completed"),
            ],
        )
        return result

    def create_version(
        self,
        ontology_id: UUID,
        *,
        ontology_definition: dict[str, Any] | None = None,
    ) -> OntologyDefinition:
        parent = self._repository.get(ontology_id)
        if parent is None:
            raise OntologyDefinitionNotFoundError("Ontology definition not found")
        if parent.status not in {
            OntologyDefinitionStatus.PUBLISHED,
            OntologyDefinitionStatus.VERSIONED,
        }:
            raise InvalidOntologyDefinitionVersionForkError(
                "Version fork requires parent status Published or Versioned"
            )

        definition = (
            dict(parent.ontology_definition)
            if ontology_definition is None
            else ontology_definition
        )

        now = datetime.now(UTC)
        child = OntologyDefinition(
            id=uuid4(),
            application_id=parent.application_id,
            version_number=parent.version_number + 1,
            previous_version_id=parent.id,
            status=OntologyDefinitionStatus.DRAFT,
            title=parent.title,
            description=parent.description,
            created_by=parent.created_by,
            created_at=now,
            updated_at=now,
            version_created_at=now,
            ontology_definition=definition,
            connector_id=parent.connector_id,
            artifact_uri=parent.artifact_uri,
            source_format=parent.source_format,
        )
        created = self._repository.create(child)
        self._record_transaction(
            transaction_type="ontology.version_forked",
            ontology=created,
            steps=[
                ("validate_request", f"Forked from version {parent.version_number}"),
                ("persist_metadata", "Persisted forked ontology metadata"),
                ("finalize", "Ontology version fork completed"),
            ],
        )
        return created

    def _require_ontology_connector(self, connector_id: UUID):
        if self._connector_repository is None:
            raise ConnectorNotFoundError("Connector repository unavailable")
        connector = self._connector_repository.get(connector_id)
        if connector is None:
            raise ConnectorNotFoundError("Connector not found")
        if connector.status != TechnologyAdapterStatus.ACTIVE:
            raise InvalidOntologyConnectorError("Connector must be Active")
        if connector.technology_type != ConnectorType.ONTOLOGY_KNOWLEDGE_GRAPH:
            raise InvalidOntologyConnectorError(
                "Ontology import requires an ontology/knowledge graph connector"
            )
        return connector

    def _record_transaction(
        self,
        *,
        transaction_type: str,
        ontology: OntologyDefinition,
        steps: list[tuple[str, str | None]],
    ) -> UUID | None:
        return self._transaction_recorder.record_orchestrated(
            transaction_type=transaction_type,
            resource_id=str(ontology.id),
            application_id=ontology.application_id,
            steps=steps,
        )


VALID_STATUS_TRANSITIONS: dict[
    OntologyDefinitionStatus, set[OntologyDefinitionStatus]
] = {
    OntologyDefinitionStatus.DRAFT: {OntologyDefinitionStatus.VALIDATED},
    OntologyDefinitionStatus.VALIDATED: {
        OntologyDefinitionStatus.APPROVED,
        OntologyDefinitionStatus.DRAFT,
    },
    OntologyDefinitionStatus.APPROVED: set(),
    OntologyDefinitionStatus.PUBLISHED: set(),
    OntologyDefinitionStatus.VERSIONED: set(),
    OntologyDefinitionStatus.RETIRED: set(),
}


def _is_valid_status_transition(
    current: OntologyDefinitionStatus, target: OntologyDefinitionStatus
) -> bool:
    return target in VALID_STATUS_TRANSITIONS[current]


def _format_validation_failure(report: OntologyValidationReport) -> str:
    errors = [finding.message for finding in report.findings if finding.level == "error"]
    if not errors:
        return "Ontology validation failed"
    return "; ".join(errors[:3])

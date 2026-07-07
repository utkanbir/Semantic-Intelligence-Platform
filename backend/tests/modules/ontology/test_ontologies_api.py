"""API tests for ontology definition CRUD, lifecycle, and versioning."""

from __future__ import annotations

from collections.abc import Generator
from unittest.mock import patch
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.modules.adapters.repositories.orm_models  # noqa: F401
import app.modules.applications.repositories.orm_models  # noqa: F401
import app.modules.audit_trace.repositories.orm_models  # noqa: F401
import app.modules.ontology.repositories.orm_models  # noqa: F401
from app.infrastructure.adapters.fuseki import fuseki_dataset_service_path
from app.infrastructure.database import get_db
from app.main import app as fastapi_app
from app.modules.applications.repositories.orm_models import Base
from app.modules.audit_trace.repositories.orm_models import SemanticTransaction, TraceStep


@pytest.fixture()
def db_engine() -> Generator[Engine, None, None]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(db_engine: Engine) -> Generator[TestClient, None, None]:
    testing_session_local = sessionmaker(
        bind=db_engine,
        autoflush=False,
        autocommit=False,
        class_=Session,
    )

    def override_get_db() -> Generator[Session, None, None]:
        db = testing_session_local()
        try:
            yield db
        finally:
            db.close()

    fastapi_app.dependency_overrides[get_db] = override_get_db
    with TestClient(fastapi_app) as test_client:
        yield test_client
    fastapi_app.dependency_overrides.clear()


def _create_application(client: TestClient) -> str:
    response = client.post(
        "/api/v1/applications",
        json={"key": f"ontology-api-{uuid4()}", "name": "Ontology API App"},
    )
    assert response.status_code == 201
    return response.json()["id"]


def _create_active_fuseki_connector(client: TestClient) -> str:
    connector_id = client.post(
        "/api/v1/connectors",
        json={
            "connector_type": "ontology_knowledge_graph",
            "connector_key": f"fuseki-{uuid4()}",
            "title": "Ontology Fuseki Connector",
            "connector_configuration": {
                "schema_version": "2",
                "vendor": "apache_fuseki",
                "connection_method": "provision_in_cluster",
                "connection": {"username": "admin", "password": "secret"},
            },
        },
    ).json()["id"]
    with patch("app.infrastructure.adapters.fuseki.urlopen") as mock_urlopen:
        mock_urlopen.return_value.__enter__.return_value.status = 200
        provision = client.post(f"/api/v1/connectors/{connector_id}/provision")
    assert provision.status_code == 200
    assert client.get(f"/api/v1/connectors/{connector_id}").json()["status"] == "Active"
    return connector_id


def test_validate_ontology_content_endpoint(client: TestClient) -> None:
    turtle = """
@prefix ex: <http://example.org/> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
<http://example.org/> a owl:Ontology .
ex:Vendor a owl:Class ;
    rdfs:label "Vendor" .
""".strip()
    response = client.post(
        "/api/v1/ontologies/validate",
        json={"source_format": "ttl", "source_content": turtle, "title": "Vendor"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["passed"] is True
    assert body["error_count"] == 0


def test_validate_ontology_content_rejects_invalid_payload(client: TestClient) -> None:
    response = client.post(
        "/api/v1/ontologies/validate",
        json={"source_format": "ttl", "source_content": "not valid turtle {"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["passed"] is False
    assert body["error_count"] >= 1


def test_create_ontology(client: TestClient) -> None:
    application_id = _create_application(client)
    response = client.post(
        "/api/v1/ontologies",
        json={
            "application_id": application_id,
            "title": "Vendor Ontology",
            "ontology_definition": {"classes": [{"name": "Vendor"}]},
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "Draft"
    assert body["ontology_definition"]["classes"][0]["name"] == "Vendor"


def test_create_ontology_records_semantic_transaction(
    client: TestClient, db_engine: Engine
) -> None:
    application_id = _create_application(client)
    response = client.post(
        "/api/v1/ontologies",
        json={"application_id": application_id, "title": "Traced Ontology"},
    )
    assert response.status_code == 201
    ontology_id = response.json()["id"]

    with Session(db_engine) as session:
        row = session.scalar(
            select(SemanticTransaction).where(
                SemanticTransaction.resource_id == ontology_id,
            )
        )
        assert row is not None
        assert row.transaction_type == "ontology.created"
        assert row.resource_type == "OntologyDefinition"


def test_patch_status_full_lifecycle(client: TestClient) -> None:
    application_id = _create_application(client)
    create = client.post(
        "/api/v1/ontologies",
        json={"application_id": application_id, "title": "Lifecycle Ontology"},
    )
    ontology_id = create.json()["id"]
    for next_status in ("Validated", "Approved"):
        response = client.patch(
            f"/api/v1/ontologies/{ontology_id}/status",
            json={"status": next_status},
        )
        assert response.status_code == 200
    assert response.json()["status"] == "Approved"


def test_delete_ontology(client: TestClient) -> None:
    application_id = _create_application(client)
    create = client.post(
        "/api/v1/ontologies",
        json={"application_id": application_id, "title": "Delete Me"},
    )
    ontology_id = create.json()["id"]
    response = client.delete(f"/api/v1/ontologies/{ontology_id}")
    assert response.status_code == 204
    get_response = client.get(f"/api/v1/ontologies/{ontology_id}")
    assert get_response.status_code == 404


def _import_ontology_draft(
    client: TestClient,
    *,
    application_id: str,
    connector_id: str,
    title: str = "Imported Vendor Ontology",
    source_content: str | None = None,
) -> dict:
    turtle = source_content or """
@prefix ex: <http://example.org/> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
<http://example.org/> a owl:Ontology .
ex:Vendor a owl:Class ;
    rdfs:label "Vendor" .
""".strip()
    response = client.post(
        "/api/v1/ontologies/import",
        json={
            "application_id": application_id,
            "title": title,
            "connector_id": connector_id,
            "source_format": "ttl",
            "source_content": turtle,
        },
    )
    assert response.status_code == 201
    return response.json()


def _advance_ontology_to_approved(client: TestClient, ontology_id: str) -> None:
    for next_status in ("Validated", "Approved"):
        response = client.patch(
            f"/api/v1/ontologies/{ontology_id}/status",
            json={"status": next_status},
        )
        assert response.status_code == 200


def test_delete_imported_ontology_removes_fuseki_graph(client: TestClient) -> None:
    application_id = _create_application(client)
    connector_id = _create_active_fuseki_connector(client)
    imported = _import_ontology_draft(
        client,
        application_id=application_id,
        connector_id=connector_id,
        title="Delete Graph Ontology",
    )
    ontology_id = imported["id"]
    _advance_ontology_to_approved(client, ontology_id)

    with patch("app.infrastructure.adapters.fuseki.urlopen") as mock_urlopen:
        mock_urlopen.return_value.__enter__.return_value.status = 204
        materialize = client.post(f"/api/v1/ontologies/{ontology_id}/materialize")
    assert materialize.status_code == 200

    mock_urlopen.reset_mock()
    mock_urlopen.return_value.__enter__.return_value.status = 204

    with patch("app.infrastructure.adapters.fuseki.urlopen", mock_urlopen):
        response = client.delete(f"/api/v1/ontologies/{ontology_id}")

    assert response.status_code == 204
    update_request = mock_urlopen.call_args.args[0]
    assert update_request.full_url.endswith("/update")
    assert update_request.method == "POST"
    assert f"urn:sip:ontology:{ontology_id}" in update_request.data.decode("utf-8")


def test_create_version_rejected_after_approved(client: TestClient) -> None:
    application_id = _create_application(client)
    create = client.post(
        "/api/v1/ontologies",
        json={"application_id": application_id, "title": "Versioned Ontology"},
    )
    ontology_id = create.json()["id"]
    for next_status in ("Validated", "Approved"):
        client.patch(
            f"/api/v1/ontologies/{ontology_id}/status",
            json={"status": next_status},
        )

    version = client.post(f"/api/v1/ontologies/{ontology_id}/versions", json={})
    assert version.status_code == 422


def test_patch_status_invalid_transition_returns_422(client: TestClient) -> None:
    application_id = _create_application(client)
    create = client.post(
        "/api/v1/ontologies",
        json={"application_id": application_id, "title": "Invalid Transition"},
    )
    ontology_id = create.json()["id"]
    response = client.patch(
        f"/api/v1/ontologies/{ontology_id}/status",
        json={"status": "Published"},
    )
    assert response.status_code == 422


def test_import_ontology_creates_draft_without_fuseki_write(
    client: TestClient, db_engine: Engine
) -> None:
    application_id = _create_application(client)
    connector_id = _create_active_fuseki_connector(client)
    turtle = """
@prefix ex: <http://example.org/> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
<http://example.org/> a owl:Ontology .
ex:Vendor a owl:Class ;
    rdfs:label "Vendor" .
""".strip()

    with patch("app.infrastructure.adapters.fuseki.urlopen") as mock_urlopen:
        response = client.post(
            "/api/v1/ontologies/import",
            json={
                "application_id": application_id,
                "title": "Imported Vendor Ontology",
                "connector_id": connector_id,
                "source_format": "ttl",
                "source_content": turtle,
            },
        )
        mock_urlopen.assert_not_called()

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "Draft"
    assert body["source_format"] == "ttl"
    assert body["connector_id"] == connector_id
    assert body["artifact_uri"] is None
    assert body["ontology_definition"]["metadata"]["import"]["source_content"] == turtle
    assert body["semantic_transaction_id"] is not None

    with Session(db_engine) as session:
        transaction = session.scalar(
            select(SemanticTransaction).where(
                SemanticTransaction.id == UUID(body["semantic_transaction_id"]),
            )
        )
        assert transaction is not None
        assert transaction.transaction_type == "ontology.imported"
        persist_step = session.scalar(
            select(TraceStep).where(
                TraceStep.semantic_transaction_id == transaction.id,
                TraceStep.step_type == "persist_artifact",
            )
        )
        assert persist_step is None


def test_materialize_ontology_persists_artifact_to_fuseki(
    client: TestClient, db_engine: Engine
) -> None:
    application_id = _create_application(client)
    connector_id = _create_active_fuseki_connector(client)
    workspace = client.get(f"/api/v1/applications/{application_id}").json()["workspace"]
    fuseki_dataset = workspace["fuseki_dataset"]
    imported = _import_ontology_draft(
        client,
        application_id=application_id,
        connector_id=connector_id,
    )
    ontology_id = imported["id"]
    _advance_ontology_to_approved(client, ontology_id)

    with patch("app.infrastructure.adapters.fuseki.urlopen") as mock_urlopen:
        mock_urlopen.return_value.__enter__.return_value.status = 204
        response = client.post(f"/api/v1/ontologies/{ontology_id}/materialize")

    assert response.status_code == 200
    body = response.json()
    assert body["artifact_uri"].startswith(f"fuseki://{fuseki_dataset}/ontologies/")
    assert body["semantic_transaction_id"] is not None

    request = mock_urlopen.call_args.args[0]
    assert "graph=urn%3Asip%3Aontology%3A" in request.full_url
    assert "/data" in request.full_url
    assert request.get_header("Content-type") == "text/turtle"

    with Session(db_engine) as session:
        transaction = session.scalar(
            select(SemanticTransaction).where(
                SemanticTransaction.id == UUID(body["semantic_transaction_id"]),
            )
        )
        assert transaction is not None
        assert transaction.transaction_type == "ontology.materialized"
        step_types = session.scalars(
            select(TraceStep.step_type).where(
                TraceStep.semantic_transaction_id == transaction.id,
            )
        ).all()
        # Materialize records only the write; ConnectorSelected / OntologyApproved
        # are owned by their dedicated lifecycle actions to avoid duplication.
        assert "OntologyMaterialized" in step_types
        assert "persist_artifact" in step_types
        assert "ConnectorSelected" not in step_types
        assert "OntologyApproved" not in step_types

        run_step_types = session.scalars(
            select(TraceStep.step_type)
            .join(
                SemanticTransaction,
                SemanticTransaction.id == TraceStep.semantic_transaction_id,
            )
            .where(SemanticTransaction.resource_id == ontology_id)
        ).all()
        # The full ontology-creation run (all transactions sharing the ontology
        # resource id) covers connector selection, approval, and materialization.
        assert "ConnectorSelected" in run_step_types
        assert "OntologyApproved" in run_step_types
        assert "OntologyMaterialized" in run_step_types

        persist_step = session.scalar(
            select(TraceStep).where(
                TraceStep.semantic_transaction_id == transaction.id,
                TraceStep.step_type == "persist_artifact",
            )
        )
        assert persist_step is not None
        assert fuseki_dataset_service_path(fuseki_dataset) in (persist_step.message or "")


def test_materialize_requires_approved_status(client: TestClient) -> None:
    application_id = _create_application(client)
    connector_id = _create_active_fuseki_connector(client)
    imported = _import_ontology_draft(
        client,
        application_id=application_id,
        connector_id=connector_id,
    )
    ontology_id = imported["id"]

    response = client.post(f"/api/v1/ontologies/{ontology_id}/materialize")
    assert response.status_code == 422


def test_materialize_blocked_when_validation_report_has_errors(
    client: TestClient,
) -> None:
    application_id = _create_application(client)
    connector_id = _create_active_fuseki_connector(client)
    imported = _import_ontology_draft(
        client,
        application_id=application_id,
        connector_id=connector_id,
    )
    ontology_id = imported["id"]
    _advance_ontology_to_approved(client, ontology_id)

    ontology = client.get(f"/api/v1/ontologies/{ontology_id}").json()
    definition = ontology["ontology_definition"]
    definition["metadata"]["validation"]["passed"] = False
    definition["metadata"]["validation"]["error_count"] = 1
    client.patch(
        f"/api/v1/ontologies/{ontology_id}",
        json={"ontology_definition": definition},
    )

    response = client.post(f"/api/v1/ontologies/{ontology_id}/materialize")
    assert response.status_code == 422


def test_patch_draft_updates_structured_definition(client: TestClient) -> None:
    application_id = _create_application(client)
    create = client.post(
        "/api/v1/ontologies",
        json={"application_id": application_id, "title": "Draft Patch Ontology"},
    )
    ontology_id = create.json()["id"]
    response = client.patch(
        f"/api/v1/ontologies/{ontology_id}",
        json={
            "ontology_definition": {
                "schema_version": "1",
                "classes": [{"name": "UpdatedClass"}],
                "properties": [],
                "relationships": [],
                "metadata": {},
            }
        },
    )
    assert response.status_code == 200
    assert response.json()["ontology_definition"]["classes"][0]["name"] == "UpdatedClass"


def test_import_ontology_rejects_invalid_rdf(client: TestClient) -> None:
    application_id = _create_application(client)
    connector_id = _create_active_fuseki_connector(client)

    response = client.post(
        "/api/v1/ontologies/import",
        json={
            "application_id": application_id,
            "title": "Invalid Ontology",
            "connector_id": connector_id,
            "source_format": "ttl",
            "source_content": "not valid turtle {",
        },
    )
    assert response.status_code == 422


def test_imported_ontology_can_be_marked_validated_after_passing_report(
    client: TestClient,
) -> None:
    application_id = _create_application(client)
    connector_id = _create_active_fuseki_connector(client)
    imported = _import_ontology_draft(
        client,
        application_id=application_id,
        connector_id=connector_id,
    )
    ontology_id = imported["id"]
    response = client.patch(
        f"/api/v1/ontologies/{ontology_id}/status",
        json={"status": "Validated"},
    )
    assert response.status_code == 200


def test_imported_ontology_validated_blocked_when_report_has_errors(
    client: TestClient,
) -> None:
    application_id = _create_application(client)
    connector_id = _create_active_fuseki_connector(client)
    imported = _import_ontology_draft(
        client,
        application_id=application_id,
        connector_id=connector_id,
    )
    ontology_id = imported["id"]
    ontology = client.get(f"/api/v1/ontologies/{ontology_id}").json()
    definition = ontology["ontology_definition"]
    definition["metadata"]["validation"]["passed"] = False
    definition["metadata"]["validation"]["error_count"] = 1
    client.patch(
        f"/api/v1/ontologies/{ontology_id}",
        json={"ontology_definition": definition},
    )

    response = client.patch(
        f"/api/v1/ontologies/{ontology_id}/status",
        json={"status": "Validated"},
    )
    assert response.status_code == 422


def test_run_ontology_validation_persists_report(client: TestClient, db_engine: Engine) -> None:
    application_id = _create_application(client)
    connector_id = _create_active_fuseki_connector(client)
    imported = _import_ontology_draft(
        client,
        application_id=application_id,
        connector_id=connector_id,
    )
    ontology_id = imported["id"]

    response = client.post(f"/api/v1/ontologies/{ontology_id}/validate")

    assert response.status_code == 200
    body = response.json()
    assert body["report"]["passed"] is True
    assert body["semantic_transaction_id"] is not None

    with Session(db_engine) as session:
        transaction = session.scalar(
            select(SemanticTransaction).where(
                SemanticTransaction.id == UUID(body["semantic_transaction_id"]),
            )
        )
        assert transaction is not None
        assert transaction.transaction_type == "ontology.validation_run"


def test_import_ontology_rejects_inactive_connector(client: TestClient) -> None:
    application_id = _create_application(client)
    connector_id = client.post(
        "/api/v1/connectors",
        json={
            "connector_type": "ontology_knowledge_graph",
            "connector_key": f"fuseki-inactive-{uuid4()}",
            "title": "Inactive Fuseki",
            "connector_configuration": {
                "schema_version": "2",
                "vendor": "apache_fuseki",
                "connection_method": "provision_in_cluster",
                "connection": {},
            },
        },
    ).json()["id"]
    client.post(f"/api/v1/connectors/{connector_id}/provision")

    response = client.post(
        "/api/v1/ontologies/import",
        json={
            "application_id": application_id,
            "title": "Should Fail",
            "connector_id": connector_id,
            "source_format": "ttl",
            "source_content": "@prefix ex: <http://example.org/> .",
        },
    )
    assert response.status_code == 422


def test_materialize_returns_502_when_fuseki_write_fails(
    client: TestClient, db_engine: Engine
) -> None:
    application_id = _create_application(client)
    connector_id = _create_active_fuseki_connector(client)
    imported = _import_ontology_draft(
        client,
        application_id=application_id,
        connector_id=connector_id,
        title="Failed Materialize",
    )
    ontology_id = imported["id"]
    _advance_ontology_to_approved(client, ontology_id)

    from urllib.error import HTTPError

    with patch("app.infrastructure.adapters.fuseki.urlopen") as mock_urlopen:
        mock_urlopen.side_effect = HTTPError(
            url="http://fuseki/data",
            code=503,
            msg="Service Unavailable",
            hdrs=None,
            fp=None,
        )
        response = client.post(f"/api/v1/ontologies/{ontology_id}/materialize")

    assert response.status_code == 502

    with Session(db_engine) as session:
        materialized_count = session.scalar(
            select(func.count())
            .select_from(SemanticTransaction)
            .where(SemanticTransaction.transaction_type == "ontology.materialized")
        )
        assert materialized_count == 0
    assert client.get(f"/api/v1/ontologies/{ontology_id}").json()["artifact_uri"] is None


def test_run_validation_includes_semantic_review_and_trace_steps(
    client: TestClient, db_engine: Engine
) -> None:
    application_id = _create_application(client)
    connector_id = _create_active_fuseki_connector(client)
    imported = _import_ontology_draft(
        client,
        application_id=application_id,
        connector_id=connector_id,
    )
    ontology_id = imported["id"]

    response = client.post(f"/api/v1/ontologies/{ontology_id}/validate")

    assert response.status_code == 200
    body = response.json()
    review = body["semantic_review"]
    assert review["available"] is True
    assert len(review["findings"]) >= 1
    assert {finding["kind"] for finding in review["findings"]} <= {
        "suggestion",
        "warning",
        "improvement",
    }
    assert all(finding["decision"] is None for finding in review["findings"])

    with Session(db_engine) as session:
        step_types = session.scalars(
            select(TraceStep.step_type).where(
                TraceStep.semantic_transaction_id == UUID(body["semantic_transaction_id"]),
            )
        ).all()
        assert "DeterministicValidationExecuted" in step_types
        assert "LLMSemanticReviewExecuted" in step_types


def test_run_validation_degrades_when_llm_unavailable(client: TestClient) -> None:
    application_id = _create_application(client)
    connector_id = _create_active_fuseki_connector(client)
    imported = _import_ontology_draft(
        client,
        application_id=application_id,
        connector_id=connector_id,
    )
    ontology_id = imported["id"]

    with patch(
        "app.modules.ontology.api.routes.resolve_llm_port", return_value=None
    ):
        response = client.post(f"/api/v1/ontologies/{ontology_id}/validate")

    assert response.status_code == 200
    body = response.json()
    assert body["report"]["passed"] is True
    assert body["semantic_review"]["available"] is False
    assert body["semantic_review"]["findings"] == []


def test_accept_suggestion_records_trace_without_mutating_definition(
    client: TestClient, db_engine: Engine
) -> None:
    application_id = _create_application(client)
    connector_id = _create_active_fuseki_connector(client)
    imported = _import_ontology_draft(
        client,
        application_id=application_id,
        connector_id=connector_id,
    )
    ontology_id = imported["id"]

    run = client.post(f"/api/v1/ontologies/{ontology_id}/validate").json()
    definition_before = run["ontology"]["ontology_definition"]
    finding_id = run["semantic_review"]["findings"][0]["id"]

    response = client.post(
        f"/api/v1/ontologies/{ontology_id}/suggestions/{finding_id}/decision",
        json={"decision": "accepted"},
    )
    assert response.status_code == 200
    body = response.json()
    accepted = next(
        finding
        for finding in body["semantic_review"]["findings"]
        if finding["id"] == finding_id
    )
    assert accepted["decision"] == "accepted"

    ontology = client.get(f"/api/v1/ontologies/{ontology_id}").json()
    assert (
        ontology["ontology_definition"]["classes"] == definition_before["classes"]
    )
    assert (
        ontology["ontology_definition"]["properties"]
        == definition_before["properties"]
    )
    assert (
        ontology["ontology_definition"]["relationships"]
        == definition_before["relationships"]
    )

    with Session(db_engine) as session:
        transaction = session.scalar(
            select(SemanticTransaction).where(
                SemanticTransaction.id == UUID(body["semantic_transaction_id"]),
            )
        )
        assert transaction is not None
        assert transaction.transaction_type == "ontology.suggestion_reviewed"
        step_types = session.scalars(
            select(TraceStep.step_type).where(
                TraceStep.semantic_transaction_id == transaction.id,
            )
        ).all()
        assert "SuggestionAccepted" in step_types


def test_ignore_suggestion_records_trace_step(client: TestClient, db_engine: Engine) -> None:
    application_id = _create_application(client)
    connector_id = _create_active_fuseki_connector(client)
    imported = _import_ontology_draft(
        client,
        application_id=application_id,
        connector_id=connector_id,
    )
    ontology_id = imported["id"]

    run = client.post(f"/api/v1/ontologies/{ontology_id}/validate").json()
    finding_id = run["semantic_review"]["findings"][0]["id"]

    response = client.post(
        f"/api/v1/ontologies/{ontology_id}/suggestions/{finding_id}/decision",
        json={"decision": "ignored"},
    )
    assert response.status_code == 200
    ignored = next(
        finding
        for finding in response.json()["semantic_review"]["findings"]
        if finding["id"] == finding_id
    )
    assert ignored["decision"] == "ignored"

    with Session(db_engine) as session:
        step = session.scalar(
            select(TraceStep).where(
                TraceStep.semantic_transaction_id
                == UUID(response.json()["semantic_transaction_id"]),
                TraceStep.step_type == "SuggestionIgnored",
            )
        )
        assert step is not None


def test_suggestion_decision_unknown_finding_returns_404(client: TestClient) -> None:
    application_id = _create_application(client)
    connector_id = _create_active_fuseki_connector(client)
    imported = _import_ontology_draft(
        client,
        application_id=application_id,
        connector_id=connector_id,
    )
    ontology_id = imported["id"]
    client.post(f"/api/v1/ontologies/{ontology_id}/validate")

    response = client.post(
        f"/api/v1/ontologies/{ontology_id}/suggestions/does-not-exist/decision",
        json={"decision": "accepted"},
    )
    assert response.status_code == 404


def test_suggestion_decision_requires_prior_review(client: TestClient) -> None:
    application_id = _create_application(client)
    create = client.post(
        "/api/v1/ontologies",
        json={"application_id": application_id, "title": "No Review Ontology"},
    )
    ontology_id = create.json()["id"]

    response = client.post(
        f"/api/v1/ontologies/{ontology_id}/suggestions/finding-1/decision",
        json={"decision": "accepted"},
    )
    assert response.status_code == 422


def _manual_definition() -> dict:
    return {
        "schema_version": "1",
        "classes": [
            {"name": "Vendor", "label": "Vendor"},
            {"name": "Invoice", "label": "Invoice"},
        ],
        "properties": [
            {
                "name": "totalAmount",
                "label": "Total Amount",
                "domain": "Invoice",
                "datatype": "decimal",
            },
        ],
        "relationships": [
            {
                "name": "issuedBy",
                "label": "Issued By",
                "domain": "Invoice",
                "range": "Vendor",
            },
        ],
        "metadata": {
            "mode": "manual",
            "manual": {
                "namespace": "https://example.org/billing#",
                "prefix": "billing",
            },
        },
    }


def test_manual_happy_path_draft_validate_connector_approve_materialize(
    client: TestClient, db_engine: Engine
) -> None:
    application_id = _create_application(client)
    connector_id = _create_active_fuseki_connector(client)

    # No graph store write happens for any step before materialize.
    with patch("app.infrastructure.adapters.fuseki.urlopen") as pre_materialize_urlopen:
        create = client.post(
            "/api/v1/ontologies",
            json={
                "application_id": application_id,
                "title": "Manual Billing Ontology",
                "ontology_definition": _manual_definition(),
            },
        )
        assert create.status_code == 201
        ontology_id = create.json()["id"]

        run = client.post(f"/api/v1/ontologies/{ontology_id}/validate")
        assert run.status_code == 200
        assert run.json()["report"]["passed"] is True

        validated = client.patch(
            f"/api/v1/ontologies/{ontology_id}/status",
            json={"status": "Validated"},
        )
        assert validated.status_code == 200

        connector = client.put(
            f"/api/v1/ontologies/{ontology_id}/connector",
            json={"connector_id": connector_id},
        )
        assert connector.status_code == 200
        assert connector.json()["connector_id"] == connector_id
        assert connector.json()["semantic_transaction_id"] is not None

        approved = client.patch(
            f"/api/v1/ontologies/{ontology_id}/status",
            json={"status": "Approved"},
        )
        assert approved.status_code == 200

        pre_materialize_urlopen.assert_not_called()

    with patch("app.infrastructure.adapters.fuseki.urlopen") as mock_urlopen:
        mock_urlopen.return_value.__enter__.return_value.status = 204
        materialize = client.post(f"/api/v1/ontologies/{ontology_id}/materialize")
        mock_urlopen.assert_called()

    assert materialize.status_code == 200
    body = materialize.json()
    assert body["id"] == ontology_id
    assert body["semantic_transaction_id"] is not None
    assert body["artifact_uri"] is not None

    request = mock_urlopen.call_args.args[0]
    assert "graph=urn%3Asip%3Aontology%3A" in request.full_url
    assert "/data" in request.full_url

    with Session(db_engine) as session:
        ordered_steps = session.execute(
            select(TraceStep.step_type)
            .join(
                SemanticTransaction,
                SemanticTransaction.id == TraceStep.semantic_transaction_id,
            )
            .where(SemanticTransaction.resource_id == ontology_id)
            .order_by(SemanticTransaction.created_at.asc(), TraceStep.step_number.asc())
        ).scalars().all()

    def _position(step_type: str) -> int:
        return ordered_steps.index(step_type)

    for expected_step in (
        "ModeSelected",
        "DraftCreated",
        "DeterministicValidationExecuted",
        "LLMSemanticReviewExecuted",
        "ConnectorSelected",
        "OntologyApproved",
        "OntologyMaterialized",
    ):
        assert expected_step in ordered_steps

    # Lifecycle ordering: draft first, materialize last.
    assert _position("ModeSelected") < _position("DraftCreated")
    assert _position("DraftCreated") < _position("DeterministicValidationExecuted")
    assert _position("ConnectorSelected") < _position("OntologyApproved")
    assert _position("OntologyApproved") < _position("OntologyMaterialized")


def test_select_connector_rejected_after_approved(client: TestClient) -> None:
    application_id = _create_application(client)
    connector_id = _create_active_fuseki_connector(client)
    imported = _import_ontology_draft(
        client,
        application_id=application_id,
        connector_id=connector_id,
    )
    ontology_id = imported["id"]
    _advance_ontology_to_approved(client, ontology_id)

    response = client.put(
        f"/api/v1/ontologies/{ontology_id}/connector",
        json={"connector_id": connector_id},
    )
    assert response.status_code == 422


def test_manual_approve_blocked_without_passing_validation(client: TestClient) -> None:
    application_id = _create_application(client)
    create = client.post(
        "/api/v1/ontologies",
        json={
            "application_id": application_id,
            "title": "Unvalidated Manual Ontology",
            "ontology_definition": _manual_definition(),
        },
    )
    ontology_id = create.json()["id"]

    # Skip validation entirely: structured drafts must not reach Validated/Approved
    # without a passing validation report on record.
    response = client.patch(
        f"/api/v1/ontologies/{ontology_id}/status",
        json={"status": "Validated"},
    )
    assert response.status_code == 422


def _generate_payload(application_id: str) -> dict:
    return {
        "application_id": application_id,
        "title": "Generated Billing Ontology",
        "description": "Billing domain from sources",
        "sources": [
            {
                "kind": "paste",
                "content": "Invoices are issued by vendors and carry a total amount.",
                "name": "notes.txt",
            },
            {
                "kind": "knowledge_source",
                "content": "Each vendor supplies goods to the company.",
                "reference_id": "ks-42",
            },
        ],
    }


def test_generate_from_sources_creates_draft_with_candidates(
    client: TestClient, db_engine: Engine
) -> None:
    application_id = _create_application(client)

    with patch("app.infrastructure.adapters.fuseki.urlopen") as mock_urlopen:
        response = client.post(
            "/api/v1/ontologies/generate",
            json=_generate_payload(application_id),
        )
        mock_urlopen.assert_not_called()

    assert response.status_code == 201
    body = response.json()
    ontology = body["ontology"]
    assert ontology["status"] == "Draft"
    assert ontology["artifact_uri"] is None
    assert ontology["ontology_definition"]["metadata"]["mode"] == "generate"
    assert len(ontology["ontology_definition"]["classes"]) >= 1

    extraction = body["extraction"]
    assert extraction["available"] is True
    assert len(extraction["classes"]) >= 1
    # Source evidence snippets attach to candidates where available.
    assert extraction["classes"][0]["evidence"][0]["snippet"]
    assert len(extraction["sources"]) == 2
    assert body["semantic_transaction_id"] is not None

    with Session(db_engine) as session:
        transaction = session.scalar(
            select(SemanticTransaction).where(
                SemanticTransaction.id == UUID(body["semantic_transaction_id"]),
            )
        )
        assert transaction is not None
        assert transaction.transaction_type == "ontology.generated"
        step_types = session.scalars(
            select(TraceStep.step_type).where(
                TraceStep.semantic_transaction_id == transaction.id,
            )
        ).all()
        assert "ModeSelected" in step_types
        assert "CandidatesExtracted" in step_types
        assert "DraftCreated" in step_types


def test_generate_from_sources_unknown_application_returns_404(client: TestClient) -> None:
    response = client.post(
        "/api/v1/ontologies/generate",
        json=_generate_payload(str(uuid4())),
    )
    assert response.status_code == 404


def test_generate_from_sources_requires_sources(client: TestClient) -> None:
    application_id = _create_application(client)
    response = client.post(
        "/api/v1/ontologies/generate",
        json={
            "application_id": application_id,
            "title": "No Sources Ontology",
            "sources": [],
        },
    )
    assert response.status_code == 422


def test_generate_from_sources_degrades_when_llm_unavailable(client: TestClient) -> None:
    application_id = _create_application(client)
    with patch(
        "app.modules.ontology.api.routes.resolve_llm_port",
        return_value=None,
    ):
        response = client.post(
            "/api/v1/ontologies/generate",
            json=_generate_payload(application_id),
        )

    assert response.status_code == 201
    body = response.json()
    assert body["ontology"]["status"] == "Draft"
    assert body["extraction"]["available"] is False
    assert body["extraction"]["classes"] == []
    assert body["extraction"]["properties"] == []
    assert body["extraction"]["relationships"] == []

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


def test_delete_imported_ontology_removes_fuseki_graph(client: TestClient) -> None:
    application_id = _create_application(client)
    connector_id = _create_active_fuseki_connector(client)
    turtle = """
@prefix ex: <http://example.org/> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
<http://example.org/> a owl:Ontology .
ex:Vendor a owl:Class .
""".strip()

    with patch("app.infrastructure.adapters.fuseki.urlopen") as mock_urlopen:
        mock_urlopen.return_value.__enter__.return_value.status = 204
        create = client.post(
            "/api/v1/ontologies/import",
            json={
                "application_id": application_id,
                "title": "Delete Graph Ontology",
                "connector_id": connector_id,
                "source_format": "ttl",
                "source_content": turtle,
            },
        )

    ontology_id = create.json()["id"]
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


def test_import_ontology_persists_artifact_to_fuseki(
    client: TestClient, db_engine: Engine
) -> None:
    application_id = _create_application(client)
    connector_id = _create_active_fuseki_connector(client)
    workspace = client.get(f"/api/v1/applications/{application_id}").json()["workspace"]
    fuseki_dataset = workspace["fuseki_dataset"]
    turtle = """
@prefix ex: <http://example.org/> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
<http://example.org/> a owl:Ontology .
ex:Vendor a owl:Class ;
    rdfs:label "Vendor" .
""".strip()

    with patch("app.infrastructure.adapters.fuseki.urlopen") as mock_urlopen:
        mock_urlopen.return_value.__enter__.return_value.status = 204
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

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "Draft"
    assert body["source_format"] == "ttl"
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
        assert transaction.transaction_type == "ontology.imported"
        persist_step = session.scalar(
            select(TraceStep).where(
                TraceStep.semantic_transaction_id == transaction.id,
                TraceStep.step_type == "persist_artifact",
            )
        )
        assert persist_step is not None
        assert "Stub" not in (persist_step.message or "")
        assert fuseki_dataset_service_path(fuseki_dataset) in (persist_step.message or "")


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
    turtle = """
@prefix ex: <http://example.org/> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
<http://example.org/> a owl:Ontology .
ex:Vendor a owl:Class ;
    rdfs:label "Vendor" .
""".strip()

    with patch("app.infrastructure.adapters.fuseki.urlopen") as mock_urlopen:
        mock_urlopen.return_value.__enter__.return_value.status = 204
        imported = client.post(
            "/api/v1/ontologies/import",
            json={
                "application_id": application_id,
                "title": "Imported Vendor Ontology",
                "connector_id": connector_id,
                "source_format": "ttl",
                "source_content": turtle,
            },
        )

    ontology_id = imported.json()["id"]
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
    turtle = """
@prefix ex: <http://example.org/> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
<http://example.org/> a owl:Ontology .
ex:Vendor a owl:Class ;
    rdfs:label "Vendor" .
""".strip()

    with patch("app.infrastructure.adapters.fuseki.urlopen") as mock_urlopen:
        mock_urlopen.return_value.__enter__.return_value.status = 204
        imported = client.post(
            "/api/v1/ontologies/import",
            json={
                "application_id": application_id,
                "title": "Imported Vendor Ontology",
                "connector_id": connector_id,
                "source_format": "ttl",
                "source_content": turtle,
            },
        )

    ontology_id = imported.json()["id"]
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
    turtle = """
@prefix ex: <http://example.org/> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
<http://example.org/> a owl:Ontology .
ex:Vendor a owl:Class ;
    rdfs:label "Vendor" .
""".strip()

    with patch("app.infrastructure.adapters.fuseki.urlopen") as mock_urlopen:
        mock_urlopen.return_value.__enter__.return_value.status = 204
        imported = client.post(
            "/api/v1/ontologies/import",
            json={
                "application_id": application_id,
                "title": "Imported Vendor Ontology",
                "connector_id": connector_id,
                "source_format": "ttl",
                "source_content": turtle,
            },
        )

    ontology_id = imported.json()["id"]

    with patch("app.infrastructure.adapters.fuseki.urlopen") as mock_urlopen:
        mock_response = mock_urlopen.return_value.__enter__.return_value
        mock_response.status = 200
        mock_response.read.return_value = turtle.encode("utf-8")
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


def test_import_ontology_returns_502_when_fuseki_write_fails(
    client: TestClient, db_engine: Engine
) -> None:
    application_id = _create_application(client)
    connector_id = _create_active_fuseki_connector(client)

    from urllib.error import HTTPError

    turtle = """
@prefix ex: <http://example.org/> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
<http://example.org/> a owl:Ontology .
ex:Vendor a owl:Class ;
    rdfs:label "Vendor" .
""".strip()

    with patch("app.infrastructure.adapters.fuseki.urlopen") as mock_urlopen:
        mock_urlopen.side_effect = HTTPError(
            url="http://fuseki/data",
            code=503,
            msg="Service Unavailable",
            hdrs=None,
            fp=None,
        )
        response = client.post(
            "/api/v1/ontologies/import",
            json={
                "application_id": application_id,
                "title": "Failed Import",
                "connector_id": connector_id,
                "source_format": "ttl",
                "source_content": turtle,
            },
        )

    assert response.status_code == 502

    with Session(db_engine) as session:
        imported_count = session.scalar(
            select(func.count())
            .select_from(SemanticTransaction)
            .where(SemanticTransaction.transaction_type == "ontology.imported")
        )
        assert imported_count == 0

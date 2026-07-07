"""Reusable E2E helpers for cross-module Assessment MVP scenarios."""

from __future__ import annotations

from typing import Any, TypedDict
from uuid import uuid4

from fastapi.testclient import TestClient

WORKSPACE_NAMESPACE_FIELDS = (
    "postgres_schema",
    "minio_namespace",
    "fuseki_dataset",
    "qdrant_collection",
    "metadata_domain",
    "ontology_namespace",
    "agent_namespace",
    "product_registry_namespace",
    "agent_registry_namespace",
)


class AssessmentFlowState(TypedDict):
    application_id: str
    application_key: str
    discovery_session_id: str
    blueprint_id: str
    asset_id: str | None
    ontology_id: str | None
    knowledge_graph_id: str | None
    product_id: str | None
    agent_id: str | None
    agent_run_id: str | None


def create_application(
    client: TestClient,
    *,
    key: str | None = None,
    name: str = "E2E Application",
    description: str | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "key": key or f"e2e-app-{uuid4()}",
        "name": name,
    }
    if description is not None:
        payload["description"] = description

    response = client.post("/api/v1/applications", json=payload)
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "provisioned"
    return body


def create_discovery_session(
    client: TestClient,
    application_id: str,
    *,
    title: str = "Assessment Discovery",
    started_by: str = "assessment-analyst",
) -> dict[str, Any]:
    response = client.post(
        "/api/v1/discovery-sessions",
        json={
            "application_id": application_id,
            "title": title,
            "started_by": started_by,
        },
    )
    assert response.status_code == 201
    return response.json()


def advance_discovery_phase(
    client: TestClient,
    session_id: str,
    *,
    notes: str | None = None,
) -> dict[str, Any]:
    payload: dict[str, str] = {}
    if notes is not None:
        payload["notes"] = notes

    response = client.post(
        f"/api/v1/discovery-sessions/{session_id}/phases/advance",
        json=payload,
    )
    assert response.status_code == 200
    return response.json()


def create_blueprint(
    client: TestClient,
    application_id: str,
    *,
    discovery_session_id: str | None = None,
    title: str = "Assessment Blueprint",
    goal: str = "Vendor assessment",
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "application_id": application_id,
        "title": title,
        "goal": goal,
    }
    if discovery_session_id is not None:
        payload["discovery_session_id"] = discovery_session_id

    response = client.post("/api/v1/blueprints", json=payload)
    assert response.status_code == 201
    return response.json()


def advance_blueprint_to_approved(client: TestClient, blueprint_id: str) -> dict[str, Any]:
    for next_status in ("Review", "Approved"):
        response = client.patch(
            f"/api/v1/blueprints/{blueprint_id}/status",
            json={"status": next_status},
        )
        assert response.status_code == 200
    body = response.json()
    assert body["status"] == "Approved"
    return body


def create_asset(
    client: TestClient,
    application_id: str,
    *,
    title: str = "Source Asset",
    asset_type: str = "Blueprint",
    resource_type: str = "Blueprint",
    resource_id: str | None = None,
) -> dict[str, Any]:
    response = client.post(
        "/api/v1/assets",
        json={
            "application_id": application_id,
            "asset_type": asset_type,
            "resource_type": resource_type,
            "resource_id": resource_id or str(uuid4()),
            "title": title,
        },
    )
    assert response.status_code == 201
    return response.json()


def create_ontology(
    client: TestClient,
    application_id: str,
    *,
    title: str = "Vendor Ontology",
) -> dict[str, Any]:
    response = client.post(
        "/api/v1/ontologies",
        json={"application_id": application_id, "title": title},
    )
    assert response.status_code == 201
    return response.json()


def advance_ontology_to_approved(client: TestClient, ontology_id: str) -> dict[str, Any]:
    for next_status in ("Validated", "Approved"):
        response = client.patch(
            f"/api/v1/ontologies/{ontology_id}/status",
            json={"status": next_status},
        )
        assert response.status_code == 200
    body = response.json()
    assert body["status"] == "Approved"
    return body


def advance_ontology_to_published(client: TestClient, ontology_id: str) -> dict[str, Any]:
    return advance_ontology_to_approved(client, ontology_id)


def create_knowledge_graph(
    client: TestClient,
    application_id: str,
    *,
    title: str = "Vendor KG",
    bound_ontology_ids: list[str] | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "application_id": application_id,
        "title": title,
    }
    if bound_ontology_ids is not None:
        payload["bound_ontology_ids"] = bound_ontology_ids

    response = client.post("/api/v1/knowledge-graphs", json=payload)
    assert response.status_code == 201
    return response.json()


def advance_knowledge_graph_to_populated(
    client: TestClient,
    registry_id: str,
) -> dict[str, Any]:
    response = client.patch(
        f"/api/v1/knowledge-graphs/{registry_id}/status",
        json={"status": "Populated"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "Populated"
    return body


def create_product(
    client: TestClient,
    application_id: str,
    *,
    title: str = "Question Bank",
    source_asset_record_ids: list[str] | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "application_id": application_id,
        "title": title,
    }
    if source_asset_record_ids is not None:
        payload["source_asset_record_ids"] = source_asset_record_ids

    response = client.post("/api/v1/products", json=payload)
    assert response.status_code == 201
    return response.json()


def advance_product_to_published(client: TestClient, product_id: str) -> dict[str, Any]:
    for next_status in ("Certified", "Published"):
        response = client.patch(
            f"/api/v1/products/{product_id}/status",
            json={"status": next_status},
        )
        assert response.status_code == 200
    body = response.json()
    assert body["status"] == "Published"
    return body


def create_agent(
    client: TestClient,
    application_id: str,
    *,
    title: str = "Assessment Agent",
    bound_product_ids: list[str] | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "application_id": application_id,
        "title": title,
    }
    if bound_product_ids is not None:
        payload["bound_product_ids"] = bound_product_ids

    response = client.post("/api/v1/agents", json=payload)
    assert response.status_code == 201
    return response.json()


def advance_agent_to_active(client: TestClient, agent_id: str) -> dict[str, Any]:
    for next_status in ("Approved", "Active"):
        response = client.patch(
            f"/api/v1/agents/{agent_id}/status",
            json={"status": next_status},
        )
        assert response.status_code == 200
    body = response.json()
    assert body["status"] == "Active"
    return body


def start_agent_run(
    client: TestClient,
    application_id: str,
    agent_definition_id: str,
    *,
    message: str = "What is the vendor security posture?",
    created_by: str = "assessment-analyst",
) -> dict[str, Any]:
    response = client.post(
        "/api/v1/agent-runs",
        json={
            "application_id": application_id,
            "agent_definition_id": agent_definition_id,
            "created_by": created_by,
            "run_payload": {"message": message},
        },
    )
    assert response.status_code == 201
    return response.json()


def list_audit_traces(client: TestClient, resource_id: str) -> list[dict[str, Any]]:
    response = client.get("/api/v1/audit-traces", params={"resource_id": resource_id})
    assert response.status_code == 200
    return response.json()


def get_audit_trace(client: TestClient, transaction_id: str) -> dict[str, Any]:
    response = client.get(f"/api/v1/audit-traces/{transaction_id}")
    assert response.status_code == 200
    return response.json()


def assert_arr004_blank_workspace(client: TestClient, application_id: str) -> None:
    """ARR-004: no semantic assets exist before knowledge asset registration (step 5)."""
    empty_endpoints = (
        ("/api/v1/assets", "application_id"),
        ("/api/v1/ontologies", "application_id"),
        ("/api/v1/knowledge-graphs", "application_id"),
        ("/api/v1/products", "application_id"),
        ("/api/v1/agents", "application_id"),
    )
    for path, param in empty_endpoints:
        response = client.get(path, params={param: application_id})
        assert response.status_code == 200
        assert response.json() == [], f"Expected empty list from {path}"


def assert_provisioned_workspace(client: TestClient, application_id: str) -> dict[str, Any]:
    response = client.get(f"/api/v1/applications/{application_id}")
    assert response.status_code == 200
    body = response.json()
    workspace = body["workspace"]
    assert workspace["status"] == "provisioned"
    for field in WORKSPACE_NAMESPACE_FIELDS:
        value = workspace[field]
        assert value, f"workspace.{field} must be populated"
    return body


def run_assessment_steps_1_4(
    client: TestClient,
    *,
    application_key: str | None = None,
) -> AssessmentFlowState:
    """Execute contract steps 1–4; return state for downstream steps."""
    key = application_key or f"assessment-mvp-{uuid4().hex[:8]}"
    application = create_application(
        client,
        key=key,
        name="Assessment MVP",
    )
    application_id = application["id"]

    session = create_discovery_session(client, application_id)
    advance_discovery_phase(client, session["id"], notes="Initial intent capture")

    blueprint = create_blueprint(
        client,
        application_id,
        discovery_session_id=session["id"],
    )
    advance_blueprint_to_approved(client, blueprint["id"])

    assert_provisioned_workspace(client, application_id)
    assert_arr004_blank_workspace(client, application_id)

    return AssessmentFlowState(
        application_id=application_id,
        application_key=key,
        discovery_session_id=session["id"],
        blueprint_id=blueprint["id"],
        asset_id=None,
        ontology_id=None,
        knowledge_graph_id=None,
        product_id=None,
        agent_id=None,
        agent_run_id=None,
    )


def run_assessment_steps_5_7(
    client: TestClient,
    state: AssessmentFlowState,
) -> AssessmentFlowState:
    """Execute contract steps 5–7 on top of steps 1–4 state."""
    application_id = state["application_id"]

    asset = create_asset(client, application_id, title="Vendor Source Document")
    ontology = create_ontology(client, application_id)
    advance_ontology_to_published(client, ontology["id"])
    kg = create_knowledge_graph(
        client,
        application_id,
        bound_ontology_ids=[ontology["id"]],
    )
    advance_knowledge_graph_to_populated(client, kg["id"])

    product = create_product(
        client,
        application_id,
        source_asset_record_ids=[asset["id"]],
    )
    advance_product_to_published(client, product["id"])

    agent = create_agent(
        client,
        application_id,
        bound_product_ids=[product["id"]],
    )
    active_agent = advance_agent_to_active(client, agent["id"])
    assert active_agent["bound_product_ids"] == [product["id"]]

    return AssessmentFlowState(
        application_id=application_id,
        application_key=state["application_key"],
        discovery_session_id=state["discovery_session_id"],
        blueprint_id=state["blueprint_id"],
        asset_id=asset["id"],
        ontology_id=ontology["id"],
        knowledge_graph_id=kg["id"],
        product_id=product["id"],
        agent_id=agent["id"],
        agent_run_id=None,
    )

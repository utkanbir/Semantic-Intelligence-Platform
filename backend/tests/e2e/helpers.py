"""Reusable E2E helpers for cross-module Assessment MVP scenarios."""

from __future__ import annotations

from typing import Any
from uuid import uuid4

from fastapi.testclient import TestClient


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


def advance_ontology_to_published(client: TestClient, ontology_id: str) -> dict[str, Any]:
    for next_status in ("Validated", "Approved", "Published"):
        response = client.patch(
            f"/api/v1/ontologies/{ontology_id}/status",
            json={"status": next_status},
        )
        assert response.status_code == 200
    body = response.json()
    assert body["status"] == "Published"
    return body


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

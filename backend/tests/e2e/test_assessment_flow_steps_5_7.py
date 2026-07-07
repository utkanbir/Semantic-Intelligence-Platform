"""Assessment MVP E2E contract steps 5–7 (S10-04 / #151)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from tests.e2e.helpers import (
    advance_agent_to_active,
    advance_knowledge_graph_to_populated,
    advance_ontology_to_published,
    advance_product_to_published,
    create_agent,
    create_asset,
    create_knowledge_graph,
    create_ontology,
    create_product,
    run_assessment_steps_1_4,
)

pytestmark = pytest.mark.e2e


def test_assessment_mvp_step_5_registers_knowledge_assets(client: TestClient) -> None:
    state = run_assessment_steps_1_4(client)
    application_id = state["application_id"]

    asset = create_asset(client, application_id, title="Vendor Source Document")
    assert asset["application_id"] == application_id

    ontology = create_ontology(client, application_id, title="Vendor Ontology")
    published_ontology = advance_ontology_to_published(client, ontology["id"])
    assert published_ontology["status"] == "Approved"

    kg = create_knowledge_graph(
        client,
        application_id,
        bound_ontology_ids=[ontology["id"]],
    )
    populated_kg = advance_knowledge_graph_to_populated(client, kg["id"])
    assert populated_kg["status"] == "Populated"

    assets = client.get("/api/v1/assets", params={"application_id": application_id})
    assert len(assets.json()) == 1
    ontologies = client.get("/api/v1/ontologies", params={"application_id": application_id})
    assert len(ontologies.json()) == 1
    graphs = client.get(
        "/api/v1/knowledge-graphs",
        params={"application_id": application_id},
    )
    assert len(graphs.json()) == 1


def test_assessment_mvp_step_6_publishes_question_bank(client: TestClient) -> None:
    state = run_assessment_steps_1_4(client)
    application_id = state["application_id"]
    asset = create_asset(client, application_id)

    product = create_product(
        client,
        application_id,
        title="Question Bank",
        source_asset_record_ids=[asset["id"]],
    )
    assert product["status"] == "Draft"

    published = advance_product_to_published(client, product["id"])
    assert published["status"] == "Published"
    assert published["title"] == "Question Bank"


def test_assessment_mvp_step_7_creates_active_assessment_agent(
    client: TestClient,
) -> None:
    state = run_assessment_steps_1_4(client)
    application_id = state["application_id"]
    asset = create_asset(client, application_id)
    product = create_product(
        client,
        application_id,
        title="Question Bank",
        source_asset_record_ids=[asset["id"]],
    )
    advance_product_to_published(client, product["id"])

    agent = create_agent(
        client,
        application_id,
        title="Assessment Agent",
        bound_product_ids=[product["id"]],
    )
    assert agent["status"] == "Draft"

    active = advance_agent_to_active(client, agent["id"])
    assert active["status"] == "Active"
    assert active["bound_product_ids"] == [product["id"]]


def test_assessment_mvp_steps_5_through_7_chained(client: TestClient) -> None:
    from tests.e2e.helpers import run_assessment_steps_5_7

    state = run_assessment_steps_1_4(client)
    final = run_assessment_steps_5_7(client, state)

    assert final["asset_id"] is not None
    assert final["ontology_id"] is not None
    assert final["knowledge_graph_id"] is not None
    assert final["product_id"] is not None
    assert final["agent_id"] is not None

    agents = client.get(
        "/api/v1/agents",
        params={"application_id": final["application_id"]},
    )
    assert len(agents.json()) == 1
    assert agents.json()[0]["status"] == "Active"

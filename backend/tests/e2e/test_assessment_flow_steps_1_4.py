"""Assessment MVP E2E contract steps 1–4 (S10-03 / #150)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from tests.e2e.helpers import (
    WORKSPACE_NAMESPACE_FIELDS,
    advance_blueprint_to_approved,
    advance_discovery_phase,
    assert_arr004_blank_workspace,
    assert_provisioned_workspace,
    create_application,
    create_blueprint,
    create_discovery_session,
)

pytestmark = pytest.mark.e2e


def test_assessment_mvp_step_1_creates_provisioned_application(
    client: TestClient,
) -> None:
    body = create_application(
        client,
        key="assessment-mvp",
        name="Assessment MVP",
    )

    assert body["key"] == "assessment-mvp"
    assert body["name"] == "Assessment MVP"
    assert body["status"] == "provisioned"
    workspace = body["workspace"]
    assert workspace["status"] == "provisioned"
    for field in WORKSPACE_NAMESPACE_FIELDS:
        assert workspace[field]


def test_assessment_mvp_step_2_starts_discovery_session(client: TestClient) -> None:
    application = create_application(client, name="Assessment MVP")
    application_id = application["id"]

    session = create_discovery_session(
        client,
        application_id,
        title="Assessment Discovery",
        started_by="assessment-analyst",
    )

    assert session["application_id"] == application_id
    assert session["title"] == "Assessment Discovery"
    assert session["started_by"] == "assessment-analyst"
    assert session["status"] == "Active"
    assert session["current_phase"]["phase_number"] == 1

    advanced = advance_discovery_phase(
        client,
        session["id"],
        notes="Captured initial vendor assessment intent",
    )
    assert advanced["current_phase"]["phase_number"] >= 2


def test_assessment_mvp_step_3_generates_and_approves_blueprint(
    client: TestClient,
) -> None:
    application = create_application(client, name="Assessment MVP")
    application_id = application["id"]
    session = create_discovery_session(client, application_id)

    blueprint = create_blueprint(
        client,
        application_id,
        discovery_session_id=session["id"],
        title="Assessment Blueprint",
        goal="Vendor assessment",
    )
    assert blueprint["status"] == "Draft"

    approved = advance_blueprint_to_approved(client, blueprint["id"])
    assert approved["status"] == "Approved"
    assert approved["approved_at"] is not None


def test_assessment_mvp_step_4_verifies_blank_workspace_arr004(
    client: TestClient,
) -> None:
    application = create_application(client, name="Assessment MVP")
    application_id = application["id"]
    session = create_discovery_session(client, application_id)
    blueprint = create_blueprint(
        client,
        application_id,
        discovery_session_id=session["id"],
    )
    advance_blueprint_to_approved(client, blueprint["id"])

    assert_provisioned_workspace(client, application_id)
    assert_arr004_blank_workspace(client, application_id)

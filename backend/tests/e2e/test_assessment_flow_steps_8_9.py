"""Assessment MVP E2E contract steps 8–9 (S10-05 / #152)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from tests.e2e.helpers import (
    get_audit_trace,
    list_audit_traces,
    run_assessment_steps_1_4,
    run_assessment_steps_5_7,
    start_agent_run,
)

pytestmark = pytest.mark.e2e


def test_assessment_mvp_step_8_agent_run_with_chat_message(client: TestClient) -> None:
    state = run_assessment_steps_1_4(client)
    ready = run_assessment_steps_5_7(client, state)

    run = start_agent_run(
        client,
        ready["application_id"],
        ready["agent_id"],
        message="What is the vendor security posture?",
        created_by="assessment-analyst",
    )

    assert run["status"] == "Completed"
    assert run["run_payload"]["message"] == "What is the vendor security posture?"
    assert run["run_result"]["status"] == "stub_completed"
    assert run["run_result"]["echo"]["message"] == "What is the vendor security posture?"


def test_assessment_mvp_step_9_audit_traces_non_empty(client: TestClient) -> None:
    state = run_assessment_steps_1_4(client)
    ready = run_assessment_steps_5_7(client, state)
    run = start_agent_run(
        client,
        ready["application_id"],
        ready["agent_id"],
    )
    run_id = run["id"]

    expected_traces = (
        (ready["application_id"], "ApplicationWorkspaceProvisioned"),
        (ready["product_id"], "product.created"),
        (ready["agent_id"], "agent.created"),
        (run_id, "agent.run.started"),
    )
    for resource_id, transaction_type in expected_traces:
        traces = list_audit_traces(client, resource_id)
        assert traces, f"Expected audit traces for resource {resource_id}"
        assert any(t["transaction_type"] == transaction_type for t in traces), (
            f"Expected {transaction_type} for resource {resource_id}, "
            f"got {[t['transaction_type'] for t in traces]}"
        )

    run_traces = list_audit_traces(client, run_id)
    detail = get_audit_trace(client, run_traces[0]["id"])
    assert detail["id"] == run_traces[0]["id"]
    assert detail["resource_id"] == run_id
    assert detail["transaction_type"] == "agent.run.started"
    assert "trace_steps" in detail


def test_assessment_mvp_steps_8_through_9_full_flow(client: TestClient) -> None:
    """Single chained run covering agent chat and trace explorer output."""
    state = run_assessment_steps_1_4(client)
    ready = run_assessment_steps_5_7(client, state)

    run = start_agent_run(
        client,
        ready["application_id"],
        ready["agent_id"],
        message="What is the vendor security posture?",
    )
    assert run["status"] == "Completed"

    all_resource_ids = [
        ready["application_id"],
        ready["product_id"],
        ready["agent_id"],
        run["id"],
    ]
    total_traces = sum(len(list_audit_traces(client, rid)) for rid in all_resource_ids)
    assert total_traces >= 4

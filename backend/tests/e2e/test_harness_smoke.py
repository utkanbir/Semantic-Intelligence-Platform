"""Smoke test proving the shared E2E harness fixtures work."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from tests.e2e.helpers import create_application

pytestmark = pytest.mark.e2e


def test_harness_creates_application(client: TestClient) -> None:
    body = create_application(
        client,
        key="assessment-mvp-smoke",
        name="Assessment MVP Smoke",
    )

    assert body["key"] == "assessment-mvp-smoke"
    assert body["status"] == "provisioned"
    assert body["workspace"]["status"] == "provisioned"
    assert body["workspace"]["postgres_schema"] == "sip_assessment_mvp_smoke"

    got = client.get(f"/api/v1/applications/{body['id']}")
    assert got.status_code == 200
    assert got.json()["id"] == body["id"]

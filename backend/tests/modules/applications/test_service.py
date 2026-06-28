"""Service-level tests for application lifecycle transitions."""

from __future__ import annotations

import pytest

from app.modules.applications.domain.enums import ApplicationStatus
from app.modules.applications.services.applications_service import _is_valid_status_transition


@pytest.mark.parametrize(
    ("current", "target", "is_allowed"),
    [
        (ApplicationStatus.CREATED, ApplicationStatus.CREATED, False),
        (ApplicationStatus.CREATED, ApplicationStatus.PROVISIONED, True),
        (ApplicationStatus.CREATED, ApplicationStatus.ACTIVE, False),
        (ApplicationStatus.CREATED, ApplicationStatus.EVOLVING, False),
        (ApplicationStatus.CREATED, ApplicationStatus.RETIRED, False),
        (ApplicationStatus.PROVISIONED, ApplicationStatus.CREATED, False),
        (ApplicationStatus.PROVISIONED, ApplicationStatus.PROVISIONED, False),
        (ApplicationStatus.PROVISIONED, ApplicationStatus.ACTIVE, True),
        (ApplicationStatus.PROVISIONED, ApplicationStatus.EVOLVING, False),
        (ApplicationStatus.PROVISIONED, ApplicationStatus.RETIRED, False),
        (ApplicationStatus.ACTIVE, ApplicationStatus.CREATED, False),
        (ApplicationStatus.ACTIVE, ApplicationStatus.PROVISIONED, False),
        (ApplicationStatus.ACTIVE, ApplicationStatus.ACTIVE, False),
        (ApplicationStatus.ACTIVE, ApplicationStatus.EVOLVING, True),
        (ApplicationStatus.ACTIVE, ApplicationStatus.RETIRED, False),
        (ApplicationStatus.EVOLVING, ApplicationStatus.CREATED, False),
        (ApplicationStatus.EVOLVING, ApplicationStatus.PROVISIONED, False),
        (ApplicationStatus.EVOLVING, ApplicationStatus.ACTIVE, False),
        (ApplicationStatus.EVOLVING, ApplicationStatus.EVOLVING, False),
        (ApplicationStatus.EVOLVING, ApplicationStatus.RETIRED, True),
        (ApplicationStatus.RETIRED, ApplicationStatus.CREATED, False),
        (ApplicationStatus.RETIRED, ApplicationStatus.PROVISIONED, False),
        (ApplicationStatus.RETIRED, ApplicationStatus.ACTIVE, False),
        (ApplicationStatus.RETIRED, ApplicationStatus.EVOLVING, False),
        (ApplicationStatus.RETIRED, ApplicationStatus.RETIRED, False),
    ],
)
def test_application_status_transition_matrix(
    current: ApplicationStatus,
    target: ApplicationStatus,
    is_allowed: bool,
) -> None:
    assert _is_valid_status_transition(current, target) is is_allowed

"""Port interfaces for the adapters module."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Protocol


class TraceRecorder(Protocol):
    """Outbound port for recording semantic transactions."""

    def record_transaction(
        self,
        *,
        transaction_type: str,
        resource_type: str,
        resource_id: str,
    ) -> None:
        """Persist one semantic transaction record."""

    def record_transaction_with_steps(
        self,
        *,
        transaction_type: str,
        resource_type: str,
        resource_id: str,
        steps: Sequence[tuple[str, str | None]],
    ) -> None:
        """Persist one semantic transaction with ordered trace steps."""

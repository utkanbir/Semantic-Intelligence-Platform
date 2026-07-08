"""Shared web content fetch helpers and errors."""

from __future__ import annotations

from urllib.parse import urlparse


class WebContentFetchError(Exception):
    """Raised when URL content cannot be fetched."""


class InvalidUrlError(Exception):
    """Raised when a URL is malformed or uses an unsupported scheme."""


def validate_fetch_url(url: str) -> str:
    """Normalize and validate a fetchable http(s) URL."""
    normalized = url.strip()
    if not normalized:
        raise InvalidUrlError("URL is required")
    parsed = urlparse(normalized)
    if parsed.scheme not in ("http", "https"):
        raise InvalidUrlError("URL must use http or https scheme")
    if not parsed.netloc:
        raise InvalidUrlError(f"URL is invalid: {normalized}")
    return normalized

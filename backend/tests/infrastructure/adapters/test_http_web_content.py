"""Unit tests for the HTTP web content adapter."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import httpx
import pytest

from app.infrastructure.adapters.http_web_content import HttpWebContentAdapter
from app.shared.web_content import InvalidUrlError, WebContentFetchError, validate_fetch_url

_HTTPX_CLIENT = "app.infrastructure.adapters.http_web_content.httpx.Client"


@pytest.mark.parametrize(
    "url",
    [
        "",
        "ftp://example.com/doc.txt",
        "not-a-url",
        "http://",
    ],
)
def test_validate_fetch_url_rejects_invalid(url: str) -> None:
    with pytest.raises(InvalidUrlError):
        validate_fetch_url(url)


def test_validate_fetch_url_accepts_http_and_https() -> None:
    assert validate_fetch_url(" https://example.com/page ") == "https://example.com/page"


def test_fetch_text_returns_decoded_body() -> None:
    adapter = HttpWebContentAdapter()
    mock_response = MagicMock()
    mock_response.iter_bytes.return_value = [b"Hello ", b"world"]
    mock_response.raise_for_status.return_value = None

    mock_stream = MagicMock()
    mock_stream.__enter__.return_value = mock_response
    mock_stream.__exit__.return_value = None

    mock_client = MagicMock()
    mock_client.stream.return_value = mock_stream
    mock_client.__enter__.return_value = mock_client
    mock_client.__exit__.return_value = None

    with patch(_HTTPX_CLIENT, return_value=mock_client):
        text = adapter.fetch_text(url="https://example.com/doc.txt")

    assert text == "Hello world"
    mock_client.stream.assert_called_once_with("GET", "https://example.com/doc.txt")


def test_fetch_text_rejects_oversized_content() -> None:
    adapter = HttpWebContentAdapter(max_bytes=4)
    mock_response = MagicMock()
    mock_response.iter_bytes.return_value = [b"12345"]
    mock_response.raise_for_status.return_value = None

    mock_stream = MagicMock()
    mock_stream.__enter__.return_value = mock_response
    mock_stream.__exit__.return_value = None

    mock_client = MagicMock()
    mock_client.stream.return_value = mock_stream
    mock_client.__enter__.return_value = mock_client
    mock_client.__exit__.return_value = None

    with (
        patch(_HTTPX_CLIENT, return_value=mock_client),
        pytest.raises(WebContentFetchError, match="maximum size"),
    ):
        adapter.fetch_text(url="https://example.com/large.txt")


def test_fetch_text_maps_http_errors() -> None:
    adapter = HttpWebContentAdapter()
    request = httpx.Request("GET", "https://example.com/missing")
    response = httpx.Response(404, request=request)

    mock_stream = MagicMock()
    mock_stream.__enter__.side_effect = httpx.HTTPStatusError(
        "not found", request=request, response=response
    )
    mock_stream.__exit__.return_value = None

    mock_client = MagicMock()
    mock_client.stream.return_value = mock_stream
    mock_client.__enter__.return_value = mock_client
    mock_client.__exit__.return_value = None

    with (
        patch(_HTTPX_CLIENT, return_value=mock_client),
        pytest.raises(WebContentFetchError, match="Failed to fetch URL"),
    ):
        adapter.fetch_text(url="https://example.com/missing")

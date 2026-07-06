"""Unit tests for the Fuseki knowledge graph adapter."""

from __future__ import annotations

import io
from unittest.mock import patch

import pytest

from app.infrastructure.adapters.fuseki import (
    FusekiImportError,
    FusekiKnowledgeGraphAdapter,
    fuseki_dataset_service_path,
)


def test_fuseki_dataset_service_path_replaces_slashes() -> None:
    assert fuseki_dataset_service_path("sip/personal-wiki") == "sip-personal-wiki"
    assert fuseki_dataset_service_path("/sip/test-app/") == "sip-test-app"


def test_fuseki_ping_checks_server_endpoint() -> None:
    configuration = {
        "connection": {"endpoint": "http://fuseki.example:3030"},
    }
    adapter = FusekiKnowledgeGraphAdapter(configuration)

    with patch("app.infrastructure.adapters.fuseki.urlopen") as mock_urlopen:
        mock_urlopen.return_value.__enter__.return_value.status = 200
        result = adapter.ping()

    assert result["status"] == "ok"
    assert result["endpoint"] == "http://fuseki.example:3030"
    request = mock_urlopen.call_args.args[0]
    assert request.full_url == "http://fuseki.example:3030/$/ping"
    assert request.method == "GET"


def test_fuseki_import_data_posts_rdf_to_dataset_endpoint() -> None:
    configuration = {
        "schema_version": "2",
        "vendor": "apache_fuseki",
        "connection_method": "provision_in_cluster",
        "connection": {"username": "admin", "password": "secret"},
        "provision": {
            "status": "provisioned",
            "endpoint": "http://fuseki.example:3030",
        },
    }
    adapter = FusekiKnowledgeGraphAdapter(configuration)
    turtle = "@prefix ex: <http://example.org/> .\nex:Vendor a ex:Class ."

    with patch("app.infrastructure.adapters.fuseki.urlopen") as mock_urlopen:
        mock_urlopen.return_value.__enter__.return_value.status = 204
        result = adapter.import_data(
            dataset="sip/test-app",
            content=turtle,
            content_type="text/turtle",
        )

    assert result["status"] == "imported"
    assert result["location"] == "http://fuseki.example:3030/sip-test-app/data"
    assert result["dataset"] == "sip/test-app"
    assert result["dataset_segment"] == "sip-test-app"

    request = mock_urlopen.call_args.args[0]
    assert request.full_url == "http://fuseki.example:3030/sip-test-app/data"
    assert request.method == "POST"
    assert request.get_header("Content-type") == "text/turtle"
    assert request.get_header("Authorization", "").startswith("Basic ")


def test_fuseki_import_data_raises_on_http_error() -> None:
    configuration = {
        "provision": {"endpoint": "http://fuseki.example:3030"},
    }
    adapter = FusekiKnowledgeGraphAdapter(configuration)

    from urllib.error import HTTPError

    with patch("app.infrastructure.adapters.fuseki.urlopen") as mock_urlopen:
        mock_urlopen.side_effect = HTTPError(
            url="http://fuseki.example:3030/sip/test-app/data",
            code=500,
            msg="Internal Server Error",
            hdrs=None,
            fp=io.BytesIO(b"error"),
        )
        with pytest.raises(FusekiImportError, match="HTTP 500"):
            adapter.import_data(
                dataset="sip/test-app",
                content="@prefix ex: <http://example.org/> .",
                content_type="text/turtle",
            )

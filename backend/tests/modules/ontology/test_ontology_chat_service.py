"""Unit tests for ontology chat helpers (S38-05)."""

from app.modules.ontology.services.ontology_chat_service import (
    OntologyChatService,
    format_ontology_context,
)


def test_format_ontology_context_includes_classes_properties_relationships() -> None:
    text = format_ontology_context(
        {
            "classes": [{"name": "Invoice", "label": "Invoice", "description": "doc"}],
            "properties": [
                {"name": "amount", "domain": "Invoice", "datatype": "decimal"},
            ],
            "relationships": [{"name": "issuedBy", "domain": "Invoice", "range": "Vendor"}],
        }
    )
    assert "Invoice" in text
    assert "amount" in text
    assert "issuedBy" in text


def test_analyze_intent_definition_lookup() -> None:
    assert (
        OntologyChatService._analyze_intent("What is Invoice?")
        == "intent=definition_lookup"
    )

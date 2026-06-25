"""Update SIP architecture docx files per SIP_Architecture_Review_Resolution_v1."""
from __future__ import annotations

import re
import shutil
import sys
from copy import deepcopy
from pathlib import Path

from docx import Document
from docx.oxml.ns import qn
from docx.text.paragraph import Paragraph

ARCH = Path(__file__).resolve().parents[1] / "architecture"


def para_text(p: Paragraph) -> str:
    return p.text or ""


def set_para_text(p: Paragraph, text: str) -> None:
    for run in p.runs:
        run.text = ""
    if p.runs:
        p.runs[0].text = text
    else:
        p.add_run(text)


def replace_in_paragraph(p: Paragraph, old: str, new: str) -> bool:
    if old in para_text(p):
        set_para_text(p, para_text(p).replace(old, new))
        return True
    return False


def replace_all(doc: Document, replacements: list[tuple[str, str]]) -> int:
    count = 0
    for p in doc.paragraphs:
        for old, new in replacements:
            if replace_in_paragraph(p, old, new):
                count += 1
    return count


def insert_after_paragraph(anchor: Paragraph, text: str) -> Paragraph:
    new_p = deepcopy(anchor._element)
    anchor._element.addnext(new_p)
    p = Paragraph(new_p, anchor._parent)
    set_para_text(p, text)
    return p


def find_paragraph(doc: Document, contains: str) -> Paragraph | None:
    for p in doc.paragraphs:
        if contains in para_text(p):
            return p
    return None


def update_domain_model() -> None:
    path = ARCH / "SIP Domain Model v1.docx"
    doc = Document(path)

    replace_all(
        doc,
        [
            (
                "├─ metadata_domain\n├─ status",
                "├─ metadata_domain\n├─ ontology_namespace\n├─ agent_namespace\n├─ product_registry_namespace\n├─ agent_registry_namespace\n├─ status",
            ),
            (
                "Which metadata catalog domain should be used?",
                "Which metadata catalog domain should be used?\nWhich ontology namespace should be used?\nWhich agent namespace should be used?\nWhich product registry namespace should be used?\nWhich agent registry namespace should be used?",
            ),
            (
                "ApplicationWorkspace represents logical isolation, not dedicated infrastructure.",
                "ApplicationWorkspace represents the logical isolation boundary of an Application Workspace, including infrastructure and semantic/runtime registry namespaces. It stores isolation metadata only; it does not manage namespace contents.",
            ),
            (
                "Draft\nReview\nApproved\nProvisioned\nRetired",
                "Draft\nReview\nApproved\nVersioned\nRetired",
            ),
            (
                "Suggested statuses:\nDraft\nActive\nPublished\nDeprecated\nRetired",
                "Suggested statuses (per asset_type; SIP Asset Catalog v1 is authoritative):\nAlign with SIP Asset Catalog v1 lifecycle states for each asset type.",
            ),
            (
                "Suggested statuses:\nDraft\nPublished\nDeprecated\nRetired",
                "Suggested statuses (SIP Asset Catalog v1 is authoritative):\nDraft\nCertified\nPublished\nVersioned\nRetired",
            ),
            (
                "Suggested statuses:\nDraft\nActive\nDeprecated\nRetired",
                "Suggested statuses (SIP Asset Catalog v1 is authoritative):\nDraft\nApproved\nActive\nVersioned\nRetired",
            ),
        ],
    )

    # DM-001 provisioning note after Design Principle
    anchor = find_paragraph(doc, "Application should not become a god object.")
    if anchor:
        nxt = anchor._element.getnext()
        if nxt is None or "ARR-004" not in (nxt.text or ""):
            insert_after_paragraph(
                anchor,
                "Provisioning note (ARR-004): Provisioning registers workspace metadata and namespace registrations only. No domain ontologies, knowledge graphs, Published Data Products, or Agents are created automatically (D-011).",
            )

    # DM-003 version metadata after Blueprint Status block
    anchor = find_paragraph(doc, "Retired\nBlueprint Does Not Own Runtime Assets")
    if anchor is None:
        anchor = find_paragraph(doc, "Blueprint Does Not Own Runtime Assets")
    if anchor:
        prev = anchor._element.getprevious()
        if prev is not None and "version_number" not in (prev.text or ""):
            insert_before = Paragraph(anchor._element, anchor._parent)
            insert_after_paragraph(
                insert_before,
                "Version metadata (separate from lifecycle state): version_number, previous_version_id, version_created_at.",
            )

    # Lifecycle authority note at end
    if not any("ARR-002" in para_text(p) for p in doc.paragraphs):
        doc.add_paragraph(
            "Lifecycle authority (ARR-002): SIP Asset Catalog v1 is authoritative for asset lifecycle states. Domain Model status enums implement Asset Catalog semantics."
        )

    doc.save(path)
    print(f"Updated: {path.name}")


def update_architecture_spec() -> None:
    path = ARCH / "SIP Architecture Specification.docx"
    doc = Document(path)

    replace_all(
        doc,
        [
            (
                "- Ontology Namespace\nApplications share platform infrastructure",
                "- Ontology Namespace\n- Agent Namespace\n- Product Registry Namespace\n- Agent Registry Namespace\n\nProvisioning creates namespace registrations and workspace metadata only. Applications remain blank workspaces (D-011, ARR-004). No domain ontologies, knowledge graphs, Published Data Products, or Agents are created automatically.\n\nApplications share platform infrastructure",
            ),
        ],
    )

    # If the above didn't match, try alternate pattern
    if not any("ARR-004" in para_text(p) for p in doc.paragraphs):
        anchor = find_paragraph(doc, "Applications share platform infrastructure but remain logically isolated.")
        if anchor:
            insert_after_paragraph(
                anchor,
                "Provisioning creates namespace registrations and workspace metadata only. Applications remain blank workspaces (D-011, ARR-004). No domain ontologies, knowledge graphs, Published Data Products, or Agents are created automatically.",
            )

    doc.save(path)
    print(f"Updated: {path.name}")


def update_discovery_workflow() -> None:
    path = ARCH / "SIP Application Discovery Workflow v1.docx"
    doc = Document(path)

    replace_all(
        doc,
        [
            (
                "Output:\nApplication Workspace",
                "Output:\nApplication Workspace\nNamespace registrations\nWorkspace metadata records\n\nNote (ARR-004): Domain semantic assets (ontologies, knowledge graphs, Published Data Products, Agents) are not created at this phase. Applications remain blank workspaces (D-011).",
            ),
        ],
    )

    doc.save(path)
    print(f"Updated: {path.name}")


def update_user_journeys() -> None:
    path = ARCH / "SIP Core User Journeys v1.docx"
    doc = Document(path)

    replace_all(
        doc,
        [
            (
                "11. SIP provisions:    - Application Workspace    - Initial Assets    - Namespaces",
                "11. SIP provisions:    - Application Workspace    - Namespace registrations    - Workspace metadata records    (\"Initial Assets\" = system-level records only; no domain ontologies, products, or agents — ARR-004, D-011)",
            ),
        ],
    )

    doc.save(path)
    print(f"Updated: {path.name}")


def update_implementation_guide() -> None:
    path = ARCH / "SIP_Implementation_Guide_v1.docx"
    doc = Document(path)

    replace_all(
        doc,
        [
            (
                "ApplicationWorkspace\nStores logical namespace metadata for PostgreSQL, MinIO, Fuseki, Qdrant and catalog domain.",
                "ApplicationWorkspace\nStores logical namespace metadata: postgres_schema, minio_namespace, fuseki_dataset, qdrant_collection, metadata_domain, ontology_namespace, agent_namespace, product_registry_namespace, agent_registry_namespace (ARR-001).",
            ),
            (
                "Keep application schemas logically isolated by ApplicationWorkspace metadata.",
                "Keep application schemas logically isolated by ApplicationWorkspace metadata.\nLifecycle states: SIP Asset Catalog v1 is authoritative (ARR-002). Version metadata (version_number, previous_version_id, version_created_at) may exist separately from lifecycle state.\nProvisioning: blank workspace only — namespace registrations and workspace metadata; no domain semantic assets (ARR-004, D-011).",
            ),
        ],
    )

    if not any("SIP_Architecture_Review_Resolution_v1" in para_text(p) for p in doc.paragraphs):
        anchor = find_paragraph(doc, "SIP_Architecture_Decision_Log_v1")
        if anchor:
            insert_after_paragraph(anchor, "SIP_Architecture_Review_Resolution_v1")

    if not any("SIP_Architecture_Review_Resolution_v1" in para_text(p) for p in doc.paragraphs):
        anchor = find_paragraph(doc, "19. Required Reading Order for Implementation")
        if anchor:
            insert_after_paragraph(anchor, "SIP_Architecture_Review_Resolution_v1 (read after Implementation Guide)")

    doc.save(path)
    print(f"Updated: {path.name}")


def update_runtime_decisions() -> None:
    path = ARCH / "sip_runtime_architecture_decisions_v1.docx"
    doc = Document(path)

    # Replace R-001 structure block
    old_structure = """sip-backend
├── application
├── blueprint
├── discovery
├── asset
├── ontology
├── knowledge_graph
├── product
├── agent
├── governance
├── adapter
├── audit_trace
└── platform_admin"""

    new_structure = """backend/app/modules/
├── applications/
├── discovery/
├── blueprints/
├── assets/
├── ontology/
├── knowledge_graph/
├── products/
├── agents/
├── agent_runtime/
├── governance/
├── adapters/
├── audit_trace/
└── platform_admin/"""

    for p in doc.paragraphs:
        t = para_text(p)
        if "sip-backend" in t and "application" in t and "platform_admin" in t:
            set_para_text(p, new_structure)
            break
        if t.strip() == "sip-backend":
            set_para_text(p, "backend/app/modules/ (ARR-003 — canonical plural module folders)")

    replace_all(
        doc,
        [
            ("├── application", "├── applications/"),
            ("├── blueprint", "├── blueprints/"),
            ("├── asset", "├── assets/"),
            ("├── product", "├── products/"),
            ("├── agent\n", "├── agents/\n"),
            ("├── adapter", "├── adapters/"),
        ],
    )

    # Remove duplicate R-007 - find second occurrence
    r007_indices = [
        i for i, p in enumerate(doc.paragraphs) if "R-007 — Discovery Module Owns Discovery History" in para_text(p)
    ]
    if len(r007_indices) >= 2:
        start = r007_indices[1]
        end = start + 1
        while end < len(doc.paragraphs):
            t = para_text(doc.paragraphs[end])
            if t.startswith("R-") and "R-007" not in t:
                break
            if t.startswith("R-008"):
                break
            end += 1
        # Remove paragraphs start..end-1 by clearing (docx delete is complex); mark as removed
        for i in range(start, end):
            if "R-008" not in para_text(doc.paragraphs[i]):
                set_para_text(doc.paragraphs[i], "")

    if not any("ARR-003" in para_text(p) for p in doc.paragraphs):
        anchor = find_paragraph(doc, "R-001 — Modular Monolith First")
        if anchor:
            insert_after_paragraph(
                anchor,
                "ARR-003: Backend module folders use canonical plural names per SIP Implementation Guide v1 and SIP_Architecture_Review_Resolution_v1.",
            )

    doc.save(path)
    print(f"Updated: {path.name}")


def update_domain_events() -> None:
    path = ARCH / "SIP Domain Events v1.docx"
    doc = Document(path)

    if not any("Lifecycle vs Events" in para_text(p) for p in doc.paragraphs):
        anchor = find_paragraph(doc, "Event Naming Principle")
        if anchor:
            insert_after_paragraph(
                anchor,
                "Lifecycle vs Events (ARR-002): Lifecycle states are defined by SIP Asset Catalog v1. Domain Events describe past-tense facts (e.g. KnowledgeGraphRefreshed). Event names need not mirror lifecycle state labels (e.g. lifecycle state Updated vs event KnowledgeGraphRefreshed).",
            )

    doc.save(path)
    print(f"Updated: {path.name}")


def update_api_boundary() -> None:
    path = ARCH / "SIP API Boundary v1.docx"
    doc = Document(path)

    if not any("ARR-003" in para_text(p) for p in doc.paragraphs):
        anchor = find_paragraph(doc, "API-003 — API Ownership by Module")
        if anchor:
            insert_after_paragraph(
                anchor,
                "Physical backend folders use canonical plural names per SIP Implementation Guide v1 and SIP_Architecture_Review_Resolution_v1 ARR-003. Example: Applications Module → applications/; Trace Module → audit_trace/.",
            )

    doc.save(path)
    print(f"Updated: {path.name}")


def main() -> None:
    updates = [
        update_domain_model,
        update_architecture_spec,
        update_discovery_workflow,
        update_user_journeys,
        update_implementation_guide,
        update_runtime_decisions,
        update_domain_events,
        update_api_boundary,
    ]
    for fn in updates:
        try:
            fn()
        except Exception as e:
            print(f"ERROR in {fn.__name__}: {e}", file=sys.stderr)
            raise


if __name__ == "__main__":
    main()

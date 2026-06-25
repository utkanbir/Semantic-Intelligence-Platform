# SIP Architecture Review Resolution v1

**Status:** Authoritative  
**Date:** 2026-06-25  
**Purpose:** Resolve Architecture Review findings before implementation.  
**Scope:** Architecture documents only. No code changes.

---

## Resolution Index

| ID | Finding | Decision | Status |
|----|---------|----------|--------|
| ARR-001 | ApplicationWorkspace namespace fields incomplete | Persist all infrastructure and semantic/runtime registry namespaces | Resolved |
| ARR-002 | Lifecycle enum conflicts between Asset Catalog and Domain Model | SIP Asset Catalog v1 is authoritative for lifecycle states | Resolved |
| ARR-003 | Singular vs plural backend module folder names | Plural names per Implementation Guide | Resolved |
| ARR-004 | "Initial Assets" vs blank application (D-011) | Provisioning creates blank workspace only | Resolved |

---

## ARR-001 — ApplicationWorkspace Namespace Alignment

### Decision

`ApplicationWorkspace` must persist both **infrastructure namespaces** and **semantic/runtime registry namespaces**.

`ApplicationWorkspace` represents the **logical isolation boundary** of an Application Workspace, not only database/storage isolation.

### Required fields

| Field | Purpose |
|-------|---------|
| `postgres_schema` | Relational data isolation |
| `minio_namespace` | Object storage isolation |
| `fuseki_dataset` | Knowledge graph store isolation |
| `qdrant_collection` | Vector store isolation |
| `metadata_domain` | Metadata catalog domain (e.g. OpenMetadata) |
| `ontology_namespace` | Ontology registry namespace |
| `agent_namespace` | Agent definition registry namespace |
| `product_registry_namespace` | Published Data Product registry namespace |
| `agent_registry_namespace` | Agent runtime/registry namespace |

### ApplicationWorkspace model (authoritative)

```
ApplicationWorkspace
├─ id
├─ application_id
├─ postgres_schema
├─ minio_namespace
├─ fuseki_dataset
├─ qdrant_collection
├─ metadata_domain
├─ ontology_namespace
├─ agent_namespace
├─ product_registry_namespace
├─ agent_registry_namespace
├─ status
├─ created_at
└─ updated_at
```

### Reason

Architecture Specification §12.2, D-010, and Discovery Workflow Phase 9 all describe provisioning of infrastructure **and** semantic/runtime registry namespaces. DM-002 previously listed only five fields. This resolution aligns the Domain Model with the platform provisioning model.

### Affected documents

- SIP Domain Model v1 — DM-002 updated
- SIP Architecture Specification — §12.2 confirmed
- SIP Application Discovery Workflow v1 — Phase 9 confirmed
- SIP Core User Journeys v1 — provisioning step clarified (see ARR-004)
- SIP Implementation Guide v1 — §8 Domain Model table updated

---

## ARR-002 — Lifecycle Enum Authority

### Decision

**SIP Asset Catalog v1 is authoritative** for asset lifecycle states.

Domain Model status enums and implementation must align with Asset Catalog. Domain Model must not redefine lifecycle semantics.

### Versioning rule

`Versioned` remains a **lifecycle state** where defined in Asset Catalog.

Version metadata may also exist separately:

- `version_number`
- `previous_version_id`
- `version_created_at`

Lifecycle state and version metadata are complementary, not mutually exclusive.

### Authoritative lifecycle states (from SIP Asset Catalog v1)

| Asset | Lifecycle states |
|-------|------------------|
| Blueprint | Draft → Review → Approved → Versioned → Retired |
| Application | Created → Provisioned → Active → Evolving → Retired |
| Ontology | Draft → Validated → Approved → Published → Versioned → Retired |
| Knowledge Graph | Created → Populated → Updated → Archived |
| Domain Information Object | Created → Validated → Published → Retired |
| Published Data Product | Draft → Certified → Published → Versioned → Retired |
| Agent | Draft → Approved → Active → Versioned → Retired |
| Policy | Draft → Approved → Active → Retired |
| Connector | Configured → Validated → Active → Retired |
| Data Source | Registered → Profiled → Active → Archived |
| Technology Adapter | Registered → Configured → Active → Deprecated → Retired |

### Domain Model alignment

| Aggregate | Prior (non-authoritative) | Aligned to Asset Catalog |
|-----------|---------------------------|--------------------------|
| Blueprint | Draft, Review, Approved, Provisioned, Retired | Draft, Review, Approved, Versioned, Retired |
| PublishedDataProduct | Draft, Published, Deprecated, Retired | Draft, Certified, Published, Versioned, Retired |
| AgentDefinition | Draft, Active, Deprecated, Retired | Draft, Approved, Active, Versioned, Retired |
| AssetRecord | Draft, Active, Published, Deprecated, Retired | Per `asset_type`; align with Asset Catalog for each type |

### Domain Events alignment

- Prefer Asset Catalog terminology where lifecycle is referenced.
- `KnowledgeGraphRefreshed` remains valid as an **event** (past-tense fact). Asset Catalog lifecycle state for Knowledge Graph uses **Updated** (not Refreshed). Events describe actions; lifecycle states describe asset status.

### Reason

Asset Catalog defines platform-wide asset lifecycle semantics. Domain Model implements them; it does not own a parallel lifecycle vocabulary.

### Affected documents

- SIP Asset Catalog v1 — unchanged (authoritative source)
- SIP Domain Model v1 — DM-003, DM-005, DM-008, DM-009 status enums updated
- SIP Domain Events v1 — lifecycle references aligned
- SIP Implementation Guide v1 — §8 updated with lifecycle authority rule

---

## ARR-003 — Backend Module Folder Naming

### Decision

Backend module folders **must use plural names** where defined by the Implementation Guide.

### Canonical backend modules

```
backend/app/modules/
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
└── platform_admin/
```

### Reason

R-001 previously listed singular names (`application`, `product`, `agent`, `adapter`) and omitted `agent_runtime`. Implementation Guide, Domain Events, and API module ownership already use plural/canonical names. This resolution eliminates singular/plural drift.

### API module naming note

API Boundary module ownership labels (e.g. "Applications Module", "Product Module") are **logical names**. Physical folder names follow the canonical list above.

The `audit_trace` module corresponds to API Boundary **Trace Module** / Semantic Trace APIs.

### Affected documents

- sip_runtime_architecture_decisions_v1 — R-001 structure updated
- SIP Implementation Guide v1 — confirmed as authoritative for folder names
- SIP API Boundary v1 — footnote added: logical module names vs canonical folder names
- `.cursor/rules/sip-backend.mdc` — reference to this resolution doc

---

## ARR-004 — Blank Application vs Initial Assets

### Decision

Application provisioning creates a **blank governed workspace**.

Provisioning must **not** automatically create:

- Domain ontologies
- Domain knowledge graphs
- Published Data Products
- Agents
- Other semantic business assets

### Definition: "Initial Assets"

The phrase **"Initial Assets"** means only:

- Workspace metadata records
- Namespace registrations
- System-level workspace records
- Optional empty catalog placeholders

It does **not** mean domain semantic assets.

### Post-provisioning behavior

After provisioning, the platform opens the Application Workspace with **recommendation-based onboarding** (D-031). Users accept, modify, or ignore recommendations. Semantic assets are created through governed workflows, not at provision time.

### Reason

Preserves D-011 (Blank Application) and D-031 (Recommendation-Based Onboarding). Resolves conflict between Journey 1 step 11 ("Initial Assets") and blank-workspace principle.

### Affected documents

- SIP Architecture Specification — §12.2 explicit blank-workspace note added
- SIP Core User Journeys v1 — Journey 1 step 11 clarified
- SIP Application Discovery Workflow v1 — Phase 9 output clarified
- SIP Domain Model v1 — DM-001/DM-002 provisioning responsibility note added
- SIP Implementation Guide v1 — provisioning rule added to §8

---

## Implementation guardrails

- No new architectural concepts introduced.
- No backend code or module scaffolding in this resolution.
- Existing decision prefixes preserved (D-*, R-*, DM-*, API-*).
- This document supplements; it does not replace source architecture documents.

---

## Document change log

| Document | Change |
|----------|--------|
| `docs/architecture/SIP_Architecture_Review_Resolution_v1.md` | Created |
| `architecture/SIP Domain Model v1.docx` | DM-002 fields; lifecycle enums; provisioning note |
| `architecture/SIP Architecture Specification.docx` | §12.2 blank workspace clarification |
| `architecture/SIP Application Discovery Workflow v1.docx` | Phase 9 provisioning output clarified |
| `architecture/SIP Core User Journeys v1.docx` | Journey 1 step 11 clarified |
| `architecture/SIP Implementation Guide v1.docx` | §8 updates; lifecycle authority; provisioning; reading order |
| `architecture/sip_runtime_architecture_decisions_v1.docx` | R-001 module list aligned; duplicate R-007 removed |
| `architecture/SIP Domain Events v1.docx` | Lifecycle vs event terminology note |
| `architecture/SIP API Boundary v1.docx` | Canonical folder name footnote |
| `.cursor/rules/sip-backend.mdc` | Reference to resolution doc |
| `architecture/SIP Asset Catalog v1.docx` | No change (authoritative) |

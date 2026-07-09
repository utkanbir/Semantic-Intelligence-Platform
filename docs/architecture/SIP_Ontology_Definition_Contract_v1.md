# Ontology Definition Contract v1

**Status:** Authoritative supplement (Sprint 7)  
**Date:** 2026-06-29  
**Issue:** S7-01 (#113)  
**Architecture references:** ARR-002, ARR-003, ARR-004, R-009, R-013, API-003, D-011  
**Companion:** [SIP_Architecture_Review_Resolution_v1.md](./SIP_Architecture_Review_Resolution_v1.md)

---

## 1. Purpose

Define the **OntologyDefinition lifecycle contract** that the `ontology` module must implement before Sprint 7 **gate = Yes** Ontology PRs merge to `develop`.

This document is binding for:

- `OntologyDefinition` aggregate shape (DM addendum — Sprint 7)
- Lifecycle states per Asset Catalog (ARR-002) for Ontology assets
- Immutable `ontology_definition` and versioning metadata
- Minimum REST API surface for Sprint 7 issues S7-02–S7-06
- Logical linkage to Application workspace `ontology_namespace` (ARR-001) without physical Fuseki provisioning

Backend implements against this contract; no alternate status enum or mutable versioned definitions.

---

## 2. Scope

| In scope | Out of scope |
|----------|--------------|
| OntologyDefinition fields | Fuseki triple store provisioning (`adapters` sprint) |
| Status enum and transition matrix (S7-04) | Platform Console Ontology Studio UI |
| Immutable definition rules (S7-05) | OWL/RDF parsing and reasoning |
| Version fork API contract (S7-05) | Automatic ontology generation from Blueprint |
| `/api/v1/ontologies` CRUD and status/version endpoints | MCP or external ontology APIs |
| Application linkage | Full OpenMetadata ontology sync |
| SemanticTransaction on create (S7-06) | TraceStep orchestration beyond existing port |

---

## 3. Aggregate relationship

```
Application (DM-001)
└── OntologyDefinition — 1:N at MVP (multiple versions per application)
    ├── version_number, previous_version_id (version chain)
    └── ontology_definition (immutable JSON once Versioned)

ApplicationWorkspace (DM-002)
└── ontology_namespace — logical registry target (not mutated by this module)
```

- `OntologyDefinition.application_id` is required; FK to `applications.id`.
- Multiple OntologyDefinition rows may exist per application (version lineage).
- Creating an ontology row **does not** populate Fuseki or mutate `ontology_namespace` (ARR-004).

---

## 4. OntologyDefinition aggregate

### 4.1 Required fields

| Field | Type (logical) | Required | Notes |
|-------|----------------|----------|-------|
| `id` | UUID | yes | Primary key |
| `application_id` | UUID | yes | FK to Application |
| `version_number` | int | yes | Starts at `1`; increments on version fork |
| `previous_version_id` | UUID | no | Null for first version; FK to prior OntologyDefinition |
| `status` | enum | yes | See §5 |
| `title` | string | yes | Human-readable ontology name |
| `description` | text | no | Summary |
| `created_by` | string | yes | Actor identifier (MVP opaque string) |
| `created_at` | datetime | yes | Row creation timestamp |
| `updated_at` | datetime | yes | Last mutation timestamp |
| `validated_at` | datetime | no | Set when status → Validated |
| `approved_at` | datetime | no | Set when status → Approved |
| `published_at` | datetime | no | Set when status → Published |
| `version_created_at` | datetime | no | Set when forked from parent (S7-05) |
| `ontology_definition` | JSON | yes | Schema metadata; see §4.2 |

### 4.2 ontology_definition (MVP stub)

```json
{
  "schema_version": "1",
  "classes": [],
  "properties": [],
  "relationships": [],
  "metadata": {}
}
```

Create may persist `{}` or the stub above. Structural RDF/OWL validation is enforced at import and before `Validated` for materialized ontologies; optional AI advisory review may augment reports.

---

## 5. Lifecycle status (ARR-002)

Authoritative labels from SIP Asset Catalog v1:

| Value | Meaning |
|-------|---------|
| `Draft` | Editable ontology in progress |
| `Validated` | Structural validation passed |
| `Approved` | Governance approval passed |
| `Published` | Available for downstream KG population |
| `Versioned` | Immutable published version |
| `Retired` | Historical; not consumable |

### 5.1 Transition matrix (MVP)

| From | Allowed targets |
|------|-----------------|
| `Draft` | `Validated` |
| `Validated` | `Approved`, `Draft` (send back) |
| `Approved` | `Published` |
| `Published` | `Versioned` |
| `Versioned` | `Retired` |
| `Retired` | *(none — terminal)* |

- Invalid transitions return **422**.
- `validated_at`, `approved_at`, `published_at` set on first entry to respective states.
- Entering `Versioned` locks `ontology_definition` (§6).
- Transition to `Validated` requires a stored validation report with `error_count = 0` when `artifact_uri` is set (imported/materialized ontologies).
- Validation report snapshot is stored at `ontology_definition.metadata.validation`.

### 5.1.1 Validation runs (Sprint 34)

| Method | Path | Behavior |
|--------|------|----------|
| `POST` | `/api/v1/ontologies/validate` | Pre-flight structural validation on submitted RDF content |
| `POST` | `/api/v1/ontologies/{id}/validate` | Re-run validation for Draft ontology; persist report; emit `ontology.validation_run` |

### 5.1.2 Draft import and materialize (Sprint 34 addendum — S34-01)

| Method | Path | Behavior |
|--------|------|----------|
| `POST` | `/api/v1/ontologies/import` | Create **Draft** only: validate RDF, persist `source_content` in `ontology_definition.metadata.import`, set `connector_id`, **`artifact_uri` null**, **no graph store write** |
| `POST` | `/api/v1/ontologies/{id}/materialize` | Requires `Approved` status and passing validation report (`error_count=0`); writes RDF to named graph `urn:sip:ontology:{id}` via `KnowledgeGraphPort`; sets `artifact_uri`; emits `ontology.materialized` |

Blocking rule: materialize fails when validation report has errors or status is not `Approved`.

### 5.2 Version fork (S7-05)

From a parent in `Published` or `Versioned`:

- Create **new** OntologyDefinition row (do not mutate parent).
- `version_number` = parent.`version_number` + 1
- `previous_version_id` = parent.`id`
- `version_created_at` = now
- `status` = `Draft`
- `ontology_definition` copied from parent or supplied in request body

---

## 6. Definition immutability

| Status | `ontology_definition` mutable via PATCH? |
|--------|------------------------------------------|
| `Draft`, `Validated`, `Approved`, `Published` | **Yes** |
| `Versioned`, `Retired` | **No** |

---

## 7. ARR-004 alignment

Creating an OntologyDefinition **must not** provision runtime semantic assets (Fuseki datasets, triples, vectors). Rows are governed metadata; materialization is deferred to `adapters` and `knowledge_graph` modules.

---

## 8. API and service expectations (Sprint 7)

| Layer | Responsibility |
|-------|----------------|
| `ontology/api` | REST under `/api/v1/ontologies` |
| `ontology/services` | Lifecycle, versioning |
| `ontology/repositories` | Persist OntologyDefinition rows |
| `ontology/domain` | Models/enums; no FastAPI/SQLAlchemy |
| Ports | `TraceRecorder` for audit (S7-06) |

### 8.6 Draft wizard endpoints (Sprint 34–35)

| Method | Path | Behavior |
|--------|------|----------|
| `POST` | `/api/v1/ontologies/import` | Draft-only import (see §5.1.2) |
| `POST` | `/api/v1/ontologies/generate` | Draft-only generate from sources (LLM extraction) |
| `PUT` | `/api/v1/ontologies/{id}/connector` | Bind connector before materialize |
| `POST` | `/api/v1/ontologies/{id}/materialize` | Write approved draft to graph store |
| `POST` | `/api/v1/ontologies/{id}/suggestions/{finding_id}/decision` | Record accept/ignore on advisory finding |
| `DELETE` | `/api/v1/ontologies/{id}` | Remove draft ontology row |

### 8.1 CRUD (S7-03)

| Method | Path | Behavior |
|--------|------|----------|
| `POST` | `/api/v1/ontologies` | Create; status `Draft`; `version_number=1` |
| `GET` | `/api/v1/ontologies` | List; filter by `application_id`; optional `status` |
| `GET` | `/api/v1/ontologies/{id}` | Get by id |
| `PATCH` | `/api/v1/ontologies/{id}` | Update title, description, definition (if mutable) |

### 8.2 Status transitions (S7-04)

| Method | Path | Behavior |
|--------|------|----------|
| `PATCH` | `/api/v1/ontologies/{id}/status` | Body `{ "status": "..." }` per §5.1 |

### 8.3 Version fork (S7-05)

| Method | Path | Behavior |
|--------|------|----------|
| `POST` | `/api/v1/ontologies/{id}/versions` | New version row per §5.2 |

### 8.4 Trace (R-013, S7-06)

| Field | Value |
|-------|-------|
| `transaction_type` | `ontology.created` |
| `resource_type` | `OntologyDefinition` |
| `resource_id` | ontology UUID |

---

## 9. Module boundaries

- `ontology` owns OntologyDefinition APIs and persistence.
- `applications` is read-only for FK validation.
- Do not expose ontology routes from other modules.
- `knowledge_graph` (S7-07+) may reference published/versioned ontologies via port; no raw SQL cross-read from routes.

---

## 10. Sprint 7 issue mapping

| Issue | Deliverable |
|-------|-------------|
| S7-01 | This contract (gate = No) |
| S7-02 | Domain models + migration |
| S7-03 | CRUD API |
| S7-04 | Lifecycle status endpoint |
| S7-05 | Version fork endpoint |
| S7-06 | SemanticTransaction on create |

---

## 11. Acceptance criteria (architect review)

- [ ] OntologyDefinition fields complete
- [ ] ARR-002 status enum and transition matrix (§5)
- [ ] Definition immutability when Versioned (§6)
- [ ] Version fork rules (§5.2)
- [ ] API paths for S7-02–S7-06 (§8)
- [ ] ARR-004 no runtime assets at create

---

## 12. References

- SIP Asset Catalog v1 — Ontology lifecycle
- [SIP_ApplicationWorkspace_Provisioning_Contract_v1.md](./SIP_ApplicationWorkspace_Provisioning_Contract_v1.md) — `ontology_namespace`
- [SIP_Blueprint_Lifecycle_Contract_v1.md](./SIP_Blueprint_Lifecycle_Contract_v1.md) — `semantic_concepts` stub

---

## Addendum S34–S35 (2026-07-08) — Draft-first creation wizard

**Supersedes for Console/API behavior:** import-centric materialize-on-import flow described implicitly in early Sprint 7–31 docs. **Core aggregate fields (§4) and ARR-002 status enum (§5) remain binding.**

### A. Draft-first lifecycle (Sprint 34)

| Rule | Implementation |
|------|----------------|
| Create / import / generate produce **Draft** only | No Fuseki/graph write until explicit **Materialize** |
| Materialize requires **Approved** + connector + passing validation | `POST /ontologies/{id}/materialize` |
| Connector selection | `PUT /ontologies/{id}/connector` (may occur after draft creation) |

### B. Three Console entry modes

| Mode | API entry | Notes |
|------|-----------|-------|
| Manual | `POST /ontologies` + structured `ontology_definition` | Forms → TTL preview |
| Import | `POST /ontologies/import` | File or paste; parse review; draft-only |
| Generate | `POST /ontologies/generate` | Sources → LLM extraction → editable draft |

Console route: `/applications/:id/ontology/create` (legacy `/ontology-studio` redirects).

### C. Validation + advisory LLM review (Sprint 34–35)

| Step | Endpoint | Blocking? |
|------|----------|-----------|
| Deterministic validation | `POST /ontologies/{id}/validate` | Errors block approve/materialize |
| Advisory semantic review | Same response includes `semantic_review` | **Non-blocking** — advisory only (stub LLM until provider wired) |
| Suggestion decision | `POST /ontologies/{id}/suggestions/{finding_id}/decision` | Records Accept/Ignore; **does not mutate** `ontology_definition` |

Finding kinds: `suggestion`, `warning`, `improvement`. Accept/Ignore UI applies to **suggestions** only.

### D. Extended `ontology_definition` shape (informative)

Beyond §4.2 stub, production payloads may include:

```json
{
  "schema_version": "1",
  "classes": [{"name": "...", "label": "...", "description": "..."}],
  "properties": [{"name": "...", "domain": "...", "datatype": "..."}],
  "relationships": [{"name": "...", "domain": "...", "range": "..."}],
  "metadata": {
    "mode": "manual|import|generate",
    "validation": { "...": "deterministic report snapshot" },
    "semantic_review": { "...": "LLM findings snapshot" },
    "generate": { "...": "extraction lineage" }
  }
}
```

### E. Trace steps (ontology creation run)

Per Sprint 34 plan §6: `ModeSelected`, `DraftCreated`, `DeterministicValidationExecuted`, `LLMSemanticReviewExecuted`, `ConnectorSelected`, `OntologyApproved`, `OntologyMaterialized`, `SuggestionAccepted`, `SuggestionIgnored`.

See [handoff.md](../handoff.md) and [SIP_Software_Architecture_Guide.md](./SIP_Software_Architecture_Guide.md).

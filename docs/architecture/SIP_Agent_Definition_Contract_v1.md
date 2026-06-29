# Agent Definition Contract v1

**Status:** Authoritative supplement (Sprint 6)  
**Date:** 2026-06-29  
**Issue:** S6-01 (#103)  
**Architecture references:** ARR-002, ARR-003, ARR-004, DM-009, D-003, R-011, R-012, R-013, API-003  
**Companion:** [SIP_Architecture_Review_Resolution_v1.md](./SIP_Architecture_Review_Resolution_v1.md)

---

## 1. Purpose

Define the **AgentDefinition lifecycle contract** that the `agents` module must implement before Sprint 6 **gate = Yes** Agents PRs merge to `develop`.

This document is binding for:

- `AgentDefinition` aggregate shape (DM-009)
- Lifecycle states per Asset Catalog (ARR-002)
- Immutable `agent_definition` and versioning metadata
- Minimum REST API surface for Sprint 6 issues S6-02–S6-06
- Published Data Product binding rules (D-003) — agents bind only to `Published` or `Versioned` products
- Definition vs. runtime split (R-011, R-012) — this module owns definitions only

Backend implements against this contract; no alternate status enum or mutable versioned definitions.

---

## 2. Scope

| In scope | Out of scope |
|----------|--------------|
| AgentDefinition fields (DM-009) | Agent runtime execution (`agent_runtime`, Sprint 8+) |
| Status enum and transition matrix (S6-04) | Platform Console Agent Studio UI |
| Immutable definition rules (S6-05) | LLM invocation, tool execution, chat sessions |
| Version fork API contract (S6-05) | Automatic agent generation from Blueprint |
| `/api/v1/agents` CRUD and status/version endpoints | MCP or external agent APIs |
| Application and PublishedDataProduct linkage (D-003) | Full policy/governance enforcement (DM-010) |
| SemanticTransaction on create (S6-06) | TraceStep orchestration beyond existing port |

---

## 3. Aggregate relationship

```
Application (DM-001)
└── AgentDefinition (DM-009) — 1:N at MVP (multiple versions per application)
    ├── version_number, previous_version_id (version chain)
    ├── agent_definition (immutable JSON once Versioned)
    └── bound_product_ids (logical references to PublishedDataProduct rows)

PublishedDataProduct (DM-008)
└── referenced by AgentDefinition.bound_product_ids (0:N at MVP)
```

- `AgentDefinition.application_id` is required; FK to `applications.id`.
- Multiple AgentDefinition rows may exist per application (version lineage).
- `bound_product_ids` is a JSON array of UUID strings referencing `published_data_products.id` within the same application (validated at service layer).
- Agents **must** consume data only through bound Published Data Products (D-003), not raw storage or adapter paths.
- `agent_runtime` (Sprint 8+) reads active definitions through `agents` ports/repositories; it does not own definition rows (R-011, R-012).

---

## 4. AgentDefinition aggregate (DM-009)

### 4.1 Required fields

| Field | Type (logical) | Required | Notes |
|-------|----------------|----------|-------|
| `id` | UUID | yes | Primary key |
| `application_id` | UUID | yes | FK to Application |
| `version_number` | int | yes | Starts at `1`; increments on version fork |
| `previous_version_id` | UUID | no | Null for first version; FK to prior AgentDefinition |
| `status` | enum | yes | See §5 |
| `title` | string | yes | Human-readable agent name |
| `description` | text | no | Agent summary |
| `created_by` | string | yes | Actor identifier (MVP opaque string) |
| `created_at` | datetime | yes | Row creation timestamp |
| `updated_at` | datetime | yes | Last mutation timestamp |
| `approved_at` | datetime | no | Set when status → Approved |
| `activated_at` | datetime | no | Set when status → Active |
| `version_created_at` | datetime | no | Set when forked from parent (S6-05) |
| `agent_definition` | JSON | yes | Capability + behavior metadata; see §4.2 |
| `bound_product_ids` | JSON array | yes | UUID strings; may be `[]` at create |

### 4.2 agent_definition (MVP stub)

At MVP, `agent_definition` is a JSON object describing design-time agent shape (aligned with Blueprint snapshot `agent_definitions[]` stub):

```json
{
  "schema_version": "1",
  "persona": "",
  "instructions": "",
  "tools": [],
  "output_schema": {},
  "metadata": {}
}
```

Create may persist `{}` or the stub above. Rich schema validation is deferred.

### 4.3 Product binding eligibility (D-003)

| PublishedDataProduct status | Bindable to AgentDefinition? |
|----------------------------|------------------------------|
| `Draft`, `Certified` | **No** |
| `Published`, `Versioned` | **Yes** |
| `Retired` | **No** |

- Service layer validates `bound_product_ids` on create, update (while mutable), and when entering `Active`.
- `404` when a referenced product id is unknown.
- `422` when a product belongs to another application or is not consumable per table above.
- Entering `Active` with non-empty `bound_product_ids` requires all bindings consumable; empty bindings allowed at MVP (runtime may reject execution later).

---

## 5. Lifecycle status (ARR-002)

Authoritative labels from SIP Asset Catalog v1 (ARR-002 resolution):

| Value | Meaning |
|-------|---------|
| `Draft` | Editable agent definition in progress |
| `Approved` | Governance/design approval passed |
| `Active` | Eligible for agent runtime registration (R-011) |
| `Versioned` | Immutable published version |
| `Retired` | Historical; not executable |

### 5.1 Transition matrix (MVP)

| From | Allowed targets |
|------|-----------------|
| `Draft` | `Approved` |
| `Approved` | `Active`, `Draft` (send back) |
| `Active` | `Versioned` |
| `Versioned` | `Retired` |
| `Retired` | *(none — terminal)* |

- Invalid transitions return **422**.
- `approved_at` is set when entering `Approved` (if not already set).
- `activated_at` is set when entering `Active` (if not already set).
- Entering `Active` runs D-003 binding validation (§4.3).
- Entering `Versioned` locks `agent_definition` and `bound_product_ids` (§6).

### 5.2 Version fork (S6-05)

From a parent in `Active` or `Versioned`:

- Create **new** AgentDefinition row (do not mutate parent).
- `version_number` = parent.`version_number` + 1
- `previous_version_id` = parent.`id`
- `version_created_at` = now
- `status` = `Draft`
- `agent_definition` copied from parent or supplied in request body (new content allowed in Draft)
- `bound_product_ids` copied from parent unless overridden in body

Parent row and definition remain unchanged.

---

## 6. Definition immutability

| Status | `agent_definition` / `bound_product_ids` mutable via PATCH? |
|--------|-------------------------------------------------------------|
| `Draft`, `Approved`, `Active` | **Yes** — scalar fields and JSON blobs |
| `Versioned`, `Retired` | **No** — definition, bindings, and lifecycle fields locked |

- Once `Versioned`, attempts to PATCH definition, bindings, or status (except to `Retired`) return **422**.
- Immutability supports agent version history and runtime pinning (DM-009).

---

## 7. ARR-004 alignment

Creating an AgentDefinition **must not** provision runtime semantic assets (ontologies, KG triples, physical tables, running agents). Definition rows are governed metadata; materialization and execution are deferred to `agent_runtime` and adapter modules.

Linking `bound_product_ids` validates PublishedDataProduct existence and D-003 eligibility only; it does not copy product data or invoke adapters.

---

## 8. API and service expectations (Sprint 6)

| Layer | Responsibility |
|-------|----------------|
| `agents/api` | REST under `/api/v1/agents` |
| `agents/services` | Lifecycle, versioning, product binding validation |
| `agents/repositories` | Persist AgentDefinition rows |
| `agents/domain` | Models/enums; no FastAPI/SQLAlchemy |
| `agents/ports` | `TraceRecorder`; `ConsumableProductReader` for D-003 checks |
| `products` | Read-only product status lookup via port (no raw SQL from agents routes) |

### 8.1 CRUD (S6-03)

| Method | Path | Behavior |
|--------|------|----------|
| `POST` | `/api/v1/agents` | Create for `application_id`; status `Draft`; `version_number=1` |
| `GET` | `/api/v1/agents` | List; filter by `application_id`; optional `status` |
| `GET` | `/api/v1/agents/{id}` | Get by id |
| `PATCH` | `/api/v1/agents/{id}` | Update title, description, definition, bindings (if mutable) |

- `404` when `application_id` or referenced PublishedDataProduct unknown.
- `422` when product belongs to another application or is not consumable.
- Register router in `api/v1/router.py` prefix `/agents`.

### 8.2 Status transitions (S6-04)

| Method | Path | Behavior |
|--------|------|----------|
| `PATCH` | `/api/v1/agents/{id}/status` | Body `{ "status": "..." }` per §5.1 |

### 8.3 Version fork (S6-05)

| Method | Path | Behavior |
|--------|------|----------|
| `POST` | `/api/v1/agents/{id}/versions` | New version row per §5.2; optional definition/bindings in body |

### 8.4 Trace (R-013, S6-06)

| Field | Value |
|-------|-------|
| `transaction_type` | `agent.created` |
| `resource_type` | `AgentDefinition` |
| `resource_id` | agent UUID |

Emit after successful persist on create.

---

## 9. Module boundaries

- `agents` owns AgentDefinition APIs and persistence.
- `applications` is read-only for FK validation.
- `products` is read-only for `bound_product_ids` validation via port; agents does not expose product CRUD.
- Do not expose agent routes from `applications/api` or `products/api`.
- `agent_runtime` (Sprint 8+) reads active/versioned definitions through `agents` ports, not raw tables.

---

## 10. Sprint 6 issue mapping

| Issue | Deliverable |
|-------|-------------|
| S6-01 | This contract (gate = No) |
| S6-02 | Domain models + migration |
| S6-03 | CRUD API |
| S6-04 | Lifecycle status endpoint |
| S6-05 | Version fork endpoint |
| S6-06 | SemanticTransaction on create |

---

## 11. Acceptance criteria (architect review)

- [ ] DM-009 fields complete
- [ ] ARR-002 status enum and transition matrix (§5)
- [ ] D-003 product binding eligibility (§4.3)
- [ ] Definition immutability when Versioned (§6)
- [ ] Version fork rules (§5.2)
- [ ] R-011 definition-only scope; no runtime execution in this module
- [ ] API paths for S6-02–S6-06 (§8)
- [ ] ARR-004 no runtime assets at create

---

## 12. References

- SIP Domain Model v1 — DM-009
- SIP Asset Catalog v1 — Agent lifecycle
- [SIP_Published_Data_Product_Contract_v1.md](./SIP_Published_Data_Product_Contract_v1.md) — D-003 consumption rules
- [SIP_ApplicationWorkspace_Provisioning_Contract_v1.md](./SIP_ApplicationWorkspace_Provisioning_Contract_v1.md) — `agent_namespace`, `agent_registry_namespace`
- [SIP_Blueprint_Lifecycle_Contract_v1.md](./SIP_Blueprint_Lifecycle_Contract_v1.md) — `agent_definitions[]` snapshot stub

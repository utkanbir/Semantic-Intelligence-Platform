# Blueprint Lifecycle Contract v1

**Status:** Authoritative supplement (Sprint 3)  
**Date:** 2026-06-28  
**Issue:** S3-01 (#57)  
**Architecture references:** ARR-002, DM-003, R-013, API-003, D-011  
**Companion:** [SIP_Architecture_Review_Resolution_v1.md](./SIP_Architecture_Review_Resolution_v1.md)

---

## 1. Purpose

Define the **Blueprint lifecycle contract** that the `blueprints` module must implement before Sprint 3 **gate = Yes** Blueprint PRs merge to `develop`.

This document is binding for:

- `Blueprint` aggregate shape (DM-003)
- Lifecycle states per Asset Catalog (ARR-002)
- Immutable `blueprint_snapshot` and versioning metadata
- Minimum REST API surface for Sprint 3 issues S3-02–S3-06

Backend implements against this contract; no alternate status enum or mutable versioned snapshots.

---

## 2. Scope

| In scope | Out of scope |
|----------|--------------|
| Blueprint fields (DM-003) | Runtime provisioning execution |
| Status enum and transition matrix (S3-04) | Platform Console Blueprint Studio UI |
| Immutable snapshot rules | Full Blueprint diff / impact analysis UI |
| Version fork API contract (S3-05) | Ontology / KG / Product materialization |
| `/api/v1/blueprints` CRUD and status/version endpoints | Discovery phase 6 automation |
| Application and DiscoverySession linkage | Agent runtime |

---

## 3. Aggregate relationship

```
Application (DM-001)
└── Blueprint (DM-003) — 1:N at MVP (multiple versions per application)
    ├── version_number, previous_version_id (version chain)
    └── blueprint_snapshot (immutable JSON once Versioned)

DiscoverySession (DM-004)
└── generated_blueprint_id → Blueprint (nullable FK; set when draft linked)
```

- `Blueprint.application_id` is required; FK to `applications.id`.
- Multiple Blueprint rows may exist per application (version lineage).
- `DiscoverySession.generated_blueprint_id` may reference a Blueprint created by this module (Sprint 3+); discovery module does not own Blueprint rows.

---

## 4. Blueprint aggregate (DM-003)

### 4.1 Required fields

| Field | Type (logical) | Required | Notes |
|-------|----------------|----------|-------|
| `id` | UUID | yes | Primary key |
| `application_id` | UUID | yes | FK to Application |
| `version_number` | int | yes | Starts at `1`; increments on version fork |
| `previous_version_id` | UUID | no | Null for first version; FK to prior Blueprint |
| `status` | enum | yes | See §5 |
| `title` | string | yes | Human-readable label |
| `goal` | text | no | Design goal summary |
| `outcome` | text | no | Expected outcome summary |
| `created_by` | string | yes | Actor identifier (MVP opaque string) |
| `created_at` | datetime | yes | Row creation timestamp |
| `approved_at` | datetime | no | Set when status → Approved (S3-04) |
| `version_created_at` | datetime | no | Set when forked from parent (S3-05) |
| `blueprint_snapshot` | JSON | yes | Design-time content blob; see §6 |

### 4.2 blueprint_snapshot (MVP stub)

At MVP, `blueprint_snapshot` is a JSON object. Minimal stub:

```json
{
  "goal": "",
  "outcome": "",
  "personas": [],
  "use_cases": [],
  "knowledge_sources": [],
  "semantic_concepts": [],
  "product_definitions": [],
  "agent_definitions": [],
  "governance_requirements": [],
  "success_metrics": []
}
```

Create may persist `{}` or the stub above. Rich schema validation is deferred.

---

## 5. Lifecycle status (ARR-002)

Authoritative labels from SIP Asset Catalog v1:

| Value | Meaning |
|-------|---------|
| `Draft` | Editable design in progress |
| `Review` | Submitted for human review |
| `Approved` | Review accepted; ready to version/publish |
| `Versioned` | Immutable published version |
| `Retired` | Historical; no further edits |

### 5.1 Transition matrix (MVP)

| From | Allowed targets |
|------|-----------------|
| `Draft` | `Review` |
| `Review` | `Approved`, `Draft` (send back) |
| `Approved` | `Versioned` |
| `Versioned` | `Retired` |
| `Retired` | *(none — terminal)* |

- Invalid transitions return **422**.
- `approved_at` is set when entering `Approved` (if not already set).
- Entering `Versioned` locks `blueprint_snapshot` (§6).

### 5.2 Version fork (S3-05)

From a parent in `Approved` or `Versioned`:

- Create **new** Blueprint row (do not mutate parent).
- `version_number` = parent.`version_number` + 1
- `previous_version_id` = parent.`id`
- `version_created_at` = now
- `status` = `Draft`
- `blueprint_snapshot` copied from parent or supplied in request body (new content allowed in Draft)

Parent row and snapshot remain unchanged.

---

## 6. Snapshot immutability

| Status | `blueprint_snapshot` mutable via PATCH? |
|--------|--------------------------------------|
| `Draft`, `Review`, `Approved` | **Yes** — scalar fields and snapshot |
| `Versioned`, `Retired` | **No** — snapshot and lifecycle fields locked |

- Once `Versioned`, attempts to PATCH snapshot or status (except to `Retired`) return **422**.
- Immutability supports Version Explorer and design history (DM-003).

---

## 7. ARR-004 alignment

Creating a Blueprint **must not** create runtime semantic assets (ontologies, KG triples, data products, agents). Snapshot content is design-time metadata only until governed downstream modules run.

---

## 8. API and service expectations (Sprint 3)

| Layer | Responsibility |
|-------|----------------|
| `blueprints/api` | REST under `/api/v1/blueprints` |
| `blueprints/services` | Lifecycle, versioning, validation |
| `blueprints/repositories` | Persist Blueprint rows |
| `blueprints/domain` | Models/enums; no FastAPI/SQLAlchemy |
| Ports | `TraceRecorder` for audit (S3-06) |

### 8.1 CRUD (S3-03)

| Method | Path | Behavior |
|--------|------|----------|
| `POST` | `/api/v1/blueprints` | Create for `application_id`; status `Draft`; `version_number=1` |
| `GET` | `/api/v1/blueprints` | List; filter by `application_id` |
| `GET` | `/api/v1/blueprints/{id}` | Get by id |
| `PATCH` | `/api/v1/blueprints/{id}` | Update title, goal, outcome, snapshot (if mutable) |

- `404` when `application_id` unknown.
- Register router in `api/v1/router.py` prefix `/blueprints`.

### 8.2 Status transitions (S3-04)

| Method | Path | Behavior |
|--------|------|----------|
| `PATCH` | `/api/v1/blueprints/{id}/status` | Body `{ "status": "..." }` per §5.1 |

### 8.3 Version fork (S3-05)

| Method | Path | Behavior |
|--------|------|----------|
| `POST` | `/api/v1/blueprints/{id}/versions` | New version row per §5.2; optional snapshot in body |

### 8.4 Trace (R-013, S3-06)

| Field | Value |
|-------|-------|
| `transaction_type` | `blueprint.created` |
| `resource_type` | `Blueprint` |
| `resource_id` | blueprint UUID |

Emit after successful persist on create.

---

## 9. Module boundaries

- `blueprints` owns Blueprint APIs and persistence.
- `applications` is read-only for FK validation.
- `discovery` may set `generated_blueprint_id` via future integration; not in S3-03 scope.
- Do not expose blueprint routes from `applications/api` or `discovery/api`.

---

## 10. Acceptance criteria (architect review)

- [ ] DM-003 fields complete
- [ ] ARR-002 status enum and transition matrix (§5)
- [ ] Snapshot immutability when Versioned (§6)
- [ ] Version fork rules (§5.2)
- [ ] API paths for S3-03–S3-06 (§8)
- [ ] ARR-004 no runtime assets at create

---

## 11. References

- SIP Domain Model v1 — DM-003
- SIP Asset Catalog v1 — Blueprint lifecycle
- [SIP_Discovery_Workflow_Contract_v1.md](./SIP_Discovery_Workflow_Contract_v1.md) — `generated_blueprint_id`
- [SIP_ApplicationWorkspace_Provisioning_Contract_v1.md](./SIP_ApplicationWorkspace_Provisioning_Contract_v1.md)

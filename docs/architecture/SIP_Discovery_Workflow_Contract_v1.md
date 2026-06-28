# Discovery Workflow Contract v1

**Status:** Authoritative supplement (Sprint 2)  
**Date:** 2026-06-28  
**Issue:** S2-01 (#44)  
**Architecture references:** ARR-004, DM-001, DM-004, R-007, R-013, API-003, D-011, D-031  
**Companion:** [SIP_Architecture_Review_Resolution_v1.md](./SIP_Architecture_Review_Resolution_v1.md)

---

## 1. Purpose

Define the **Discovery workflow contract** that the `discovery` module must implement before Sprint 2 **gate = Yes** Discovery PRs merge to `develop`.

This document is binding for:

- `DiscoverySession` aggregate shape (DM-004)
- Ten-phase workflow ordering (SIP Application Discovery Workflow v1)
- Append-only phase history persistence (R-007)
- Minimum REST API surface for Sprint 2 issues S2-03–S2-06

Backend implements against this contract; no alternate field set, phase order, or session-start semantic asset creation.

---

## 2. Scope

| In scope | Out of scope |
|----------|--------------|
| Ten discovery phases and ordering | LLM conversation orchestration |
| `DiscoverySession` fields (DM-004) | Blueprint module APIs (Sprint 3) |
| `DiscoveryPhaseHistory` append-only model (R-007) | Automated phase content generation |
| Session status enum and transition rules (documented; S2-04 implements) | Full Platform Console Discovery UI |
| `/api/v1/discovery-sessions` CRUD and phase/status endpoint contracts | Physical adapter provisioning (adapters module) |
| Application 1:N session relationship at MVP | Ontology / KG population |

---

## 3. Aggregate relationship

```
Application (DM-001)
└── DiscoverySession (DM-004) — 1:N at MVP
    ├── DiscoveryPhaseHistory[] (R-007) — append-only
    └── generated_blueprint_id → Blueprint (nullable FK; Sprint 3)
```

- One **Application** may have **many** `DiscoverySession` records at MVP.
- `DiscoverySession.application_id` is required; FK to `applications.id`.
- A session belongs to exactly one Application; sessions do not span applications.
- `generated_blueprint_id` is nullable until Blueprint draft linkage is implemented (Sprint 3).

---

## 4. Discovery workflow phases

Phases are **ordered 1–10**. Phase names are canonical per SIP Application Discovery Workflow v1.

| # | Phase name | Purpose (MVP contract) |
|---|------------|------------------------|
| 1 | Intent Discovery | Capture business intent, goals, and scope for the application |
| 2 | User Discovery | Identify personas, stakeholders, and user needs |
| 3 | Knowledge Discovery | Inventory existing knowledge sources, documents, and data |
| 4 | Behavior Discovery | Map processes, workflows, and system interactions |
| 5 | Semantic Discovery | Identify concepts, entities, relationships, and semantic boundaries |
| 6 | Blueprint Draft Generation | Produce a draft Blueprint artifact from discovery outputs |
| 7 | Human Review | Reviewer validates and refines the draft Blueprint |
| 8 | Semantic Design | Formalize ontology, schema, and semantic structure decisions |
| 9 | Application Provisioning | Provision workspace infrastructure and registry namespaces per approved design |
| 10 | Application Evolution | Ongoing refinement; session may complete or hand off to governed evolution |

**Rules:**

- New sessions **start at Phase 1** (Intent Discovery).
- `current_phase` is **derived** from the latest `DiscoveryPhaseHistory` entry (see §6); it is not a separately mutable column at MVP.
- Phase advance moves to the **next sequential** phase (1→2→…→10). No skip-ahead at MVP unless a future ADR defines exceptions.
- Phase 9 aligns with ARR-001/ARR-004: provisioning registers workspace metadata and namespaces; it does **not** auto-create domain semantic assets (D-011).
- Phase 6 output (`generated_blueprint_id`) is a placeholder FK until the `blueprints` module is available (Sprint 3).

---

## 5. DiscoverySession aggregate (DM-004)

### 5.1 Required fields

| Field | Type (logical) | Required | Notes |
|-------|----------------|----------|-------|
| `id` | UUID | yes | Primary key |
| `application_id` | UUID | yes | FK to Application |
| `status` | enum | yes | See §5.2 |
| `title` | string | yes | Human-readable session label |
| `started_by` | string | yes | Actor identifier (MVP: opaque string; auth stub) |
| `started_at` | datetime | yes | Session creation timestamp |
| `completed_at` | datetime | no | Set when status → Completed (S2-04) |
| `intent_summary` | text / JSON | no | Structured or free-text intent capture |
| `discovery_notes` | text / JSON | no | General session notes |
| `recommendations` | JSON | no | Recommendation payloads (D-031 alignment; MVP JSON array stub) |
| `generated_blueprint_id` | UUID | no | Nullable FK to Blueprint; Sprint 3 |
| `conversation_history` | JSON | no | Persisted conversation turns; MVP JSON array stub `[]` |

### 5.2 Session status enum

| Value | Meaning |
|-------|---------|
| `Active` | Session in progress; phase advance allowed |
| `Paused` | Temporarily suspended; no phase advance |
| `Completed` | Discovery workflow finished; terminal for active work |
| `Archived` | Historical record; terminal; no mutations except audit |

Status transitions are implemented in S2-04. Contract expectations:

- New sessions are created with status `Active`.
- `Archived` is terminal (no return to `Active`).
- Phase advance (S2-05) is rejected (422) when status is not `Active`.
- `completed_at` is set when transitioning to `Completed`.

### 5.3 JSON field shapes (MVP stub)

At MVP, JSON fields may use minimal stub structures:

```json
// recommendations (example)
[]

// conversation_history (example)
[
  { "role": "user", "content": "...", "timestamp": "2026-06-28T12:00:00Z" }
]
```

Implementations must persist these columns; rich schema validation is deferred.

---

## 6. Phase history (R-007)

The **discovery module owns discovery history**. Phase progression is recorded in an append-only `DiscoveryPhaseHistory` entity.

### 6.1 Fields

| Field | Type (logical) | Required | Notes |
|-------|----------------|----------|-------|
| `id` | UUID | yes | Primary key |
| `session_id` | UUID | yes | FK to DiscoverySession |
| `phase_number` | int | yes | 1–10 |
| `phase_name` | string | yes | Canonical name from §4 |
| `entered_at` | datetime | yes | When session entered this phase |
| `notes` | text | no | Optional context on phase entry |

### 6.2 Persistence rules

- **Append-only:** no update or delete of past history entries at MVP.
- On session create, insert the **first** history row: `phase_number=1`, `phase_name=Intent Discovery`, `entered_at=started_at`.
- On phase advance, append the next sequential entry; do not modify prior rows.
- `current_phase` = `{ phase_number, phase_name }` from the row with the latest `entered_at` for the session.
- History is queryable in ascending `entered_at` order.

### 6.3 Guards

- Cannot advance past phase 10 (422).
- Cannot advance when session status ≠ `Active` (422).
- Phase number on new entry must equal previous `phase_number + 1`.

---

## 7. ARR-004 alignment — no semantic assets at session start

Creating a `DiscoverySession` **must not** create runtime semantic assets:

- No ontologies, knowledge graph content, data products, or agents
- No Blueprint records (until Phase 6 workflow is implemented)
- No modification of `ApplicationWorkspace` namespace fields beyond what already exists from Application provisioning

Creating a session **may** create only:

- `DiscoverySession` row with MVP fields
- Initial `DiscoveryPhaseHistory` entry (Phase 1)
- Optional **SemanticTransaction** trace stub on create (R-013; S2-06)

Semantic assets are created through later governed phases (especially Phases 6–9), not at session start. This preserves D-011 (Blank Application) and ARR-004.

---

## 8. API and service expectations (Sprint 2)

| Layer | Responsibility |
|-------|----------------|
| `discovery/api` | REST routes under `/api/v1/discovery-sessions` |
| `discovery/services` | Session lifecycle, phase advance, validation |
| `discovery/repositories` | Persist session + phase history |
| `discovery/domain` | Models/enums; no FastAPI/SQLAlchemy imports |
| Ports | `RelationalDB` for persistence; `TraceRecorder` for audit (S2-06) |

### 8.1 CRUD (S2-03)

| Method | Path | Behavior |
|--------|------|----------|
| `POST` | `/api/v1/discovery-sessions` | Create session for `application_id`; status `Active`; Phase 1 history |
| `GET` | `/api/v1/discovery-sessions` | List sessions; filter by `application_id` |
| `GET` | `/api/v1/discovery-sessions/{id}` | Get session by id (includes derived `current_phase`) |
| `PATCH` | `/api/v1/discovery-sessions/{id}` | Update `title`, `intent_summary`, `discovery_notes`, `recommendations`, `conversation_history` |

- `404` when `application_id` references unknown Application.
- Register router in `api/v1/router.py`.

### 8.2 Status transitions (S2-04)

| Method | Path | Behavior |
|--------|------|----------|
| `PATCH` | `/api/v1/discovery-sessions/{id}/status` | Body `{ "status": "Active" \| "Paused" \| "Completed" \| "Archived" }` |

### 8.3 Phase progression (S2-05)

| Method | Path | Behavior |
|--------|------|----------|
| `POST` | `/api/v1/discovery-sessions/{id}/phases/advance` | Advance to next phase; optional `notes` in body |
| `GET` | `/api/v1/discovery-sessions/{id}/phases` | List phase history (ascending `entered_at`) |

### 8.4 Response shape (minimum)

Session responses should include:

- All DM-004 scalar fields
- `current_phase`: `{ "phase_number": int, "phase_name": string }`
- Optional `phase_history` on detail GET (or via `/phases` sub-resource)

---

## 9. Events and trace (R-013)

Significant action: **DiscoverySession created**.

| Field | Value |
|-------|-------|
| `transaction_type` | `discovery.session.created` |
| `resource_type` | `DiscoverySession` |
| `resource_id` | session UUID |

- Emit after successful persist of session + initial phase history (S2-06).
- Coordinate with `audit_trace` stub pattern from `applications` module.
- Phase advance tracing is optional/deferred at MVP.

Exact event names must match Domain Events doc when implementation PR opens.

---

## 10. Module boundaries

- `discovery` module owns `DiscoverySession` and `DiscoveryPhaseHistory` APIs and persistence.
- `applications` module is read-only for FK validation (`application_id`).
- `blueprints` module owns Blueprint aggregates; `generated_blueprint_id` is a forward reference only at Sprint 2.
- Do not expose discovery endpoints from `applications/api`.

---

## 11. Acceptance criteria (contract)

- [ ] Ten phases named and ordered per Discovery Workflow v1 (§4)
- [ ] DM-004 fields enumerated with persistence rules (§5)
- [ ] Session status enum: Active, Paused, Completed, Archived (§5.2)
- [ ] Phase history model defined — append-only entries (§6)
- [ ] `current_phase` derived from latest history entry (§6.2)
- [ ] Application 1:N relationship documented (§3)
- [ ] ARR-004: no semantic assets at session start (§7)
- [ ] API expectations documented for S2-03–S2-05 (§8)
- [ ] Referenced by Discovery module issues and gate = Yes PRs
- [ ] Architect review: contract completeness vs DM-004 and workflow docx

---

## 12. References

- [SIP_Architecture_Review_Resolution_v1.md](./SIP_Architecture_Review_Resolution_v1.md) — ARR-004
- [SIP_ApplicationWorkspace_Provisioning_Contract_v1.md](./SIP_ApplicationWorkspace_Provisioning_Contract_v1.md) — blank workspace baseline
- [SIP_GITHUB_WORKFLOW.md](../project/SIP_GITHUB_WORKFLOW.md) — Sprint 2 milestone
- Canonical `.docx`: `architecture/SIP_Domain_Model_v1` (DM-004), `architecture/SIP Application Discovery Workflow v1`

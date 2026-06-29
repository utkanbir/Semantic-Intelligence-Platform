# Agent Runtime Contract v1

**Status:** Authoritative supplement (Sprint 8)  
**Date:** 2026-06-29  
**Issue:** S8-06 (#133)  
**Architecture references:** ARR-002, ARR-004, R-011, R-012, R-013, D-003, API-003  
**Companion:** [SIP_Agent_Definition_Contract_v1.md](./SIP_Agent_Definition_Contract_v1.md)

---

## 1. Purpose

Define the **AgentRun execution contract** that the `agent_runtime` module must implement before Sprint 8 **gate = Yes** Agent Runtime PRs merge to `develop`.

Binding for:

- `AgentRun` aggregate shape (DM addendum — Sprint 8)
- D-003 runtime enforcement (TD-014 resolution)
- Stub execution API for S8-07–S8-09

---

## 2. Scope

| In scope | Out of scope |
|----------|--------------|
| AgentRun persistence and stub execution | LLM inference, tool orchestration |
| D-003 validation at run start | Physical adapter provisioning |
| `/api/v1/agent-runs` POST + GET | MCP external APIs |
| SemanticTransaction on run start | Multi-step trace orchestration (TD-006) |

---

## 3. Aggregate relationship

```
Application
└── AgentDefinition (agents module — read-only)
    └── AgentRun — 1:N execution rows
        ├── agent_definition_id (FK logical via port)
        └── run_payload / run_result (JSON stubs)
```

- `agent_runtime` reads AgentDefinition through `ExecutableAgentReader` port; it does not own definition rows (R-011, R-012).

---

## 4. AgentRun aggregate

### 4.1 Required fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | UUID | yes | PK |
| `application_id` | UUID | yes | FK `applications.id` |
| `agent_definition_id` | UUID | yes | References agents row |
| `status` | enum | yes | See §5 |
| `created_by` | string | yes | |
| `created_at` | datetime | yes | |
| `updated_at` | datetime | yes | |
| `started_at` | datetime | no | |
| `completed_at` | datetime | no | |
| `run_payload` | JSON | yes | Input stub |
| `run_result` | JSON | no | Output stub on completion |

### 4.2 Executable agent eligibility

| AgentDefinition status | Runnable? |
|------------------------|-----------|
| `Draft`, `Approved` | **No** |
| `Active`, `Versioned` | **Yes** |
| `Retired` | **No** |

### 4.3 D-003 runtime enforcement

Before starting a run:

1. AgentDefinition must exist and belong to `application_id`.
2. Agent status must be `Active` or `Versioned`.
3. `bound_product_ids` must be **non-empty**.
4. Every bound product must be `Published` or `Versioned` and belong to the same application.

Violations return **422** (binding) or **404** (unknown agent/product).

---

## 5. Lifecycle status (MVP stub)

| Value | Meaning |
|-------|---------|
| `Pending` | Run accepted, not yet started |
| `Running` | Stub execution in progress |
| `Completed` | Stub finished successfully |
| `Failed` | Stub failure (reserved) |

MVP stub: `POST` creates run, immediately transitions `Pending` → `Running` → `Completed` with deterministic stub `run_result`.

---

## 6. API (Sprint 8)

| Method | Path | Behavior |
|--------|------|----------|
| `POST` | `/api/v1/agent-runs` | Start stub run; D-003 validation |
| `GET` | `/api/v1/agent-runs` | List; filter by `application_id`, optional `run_status` |
| `GET` | `/api/v1/agent-runs/{id}` | Get run |

### Trace

| Field | Value |
|-------|-------|
| `transaction_type` | `agent.run.started` |
| `resource_type` | `AgentRun` |

---

## 7. Module boundaries

- `agent_runtime` owns AgentRun APIs and persistence.
- `agents` is read-only via `ExecutableAgentReader` port.
- `products` is read-only via the same port chain for D-003 checks.
- Do not expose agent-run routes from `agents/api`.

---

## 8. Sprint 8 issue mapping

| Issue | Deliverable |
|-------|-------------|
| S8-06 | This contract |
| S8-07 | Domain + migration |
| S8-08 | Agent run API (D-003) |
| S8-09 | SemanticTransaction on run start |

---

## 9. References

- SIP Agent Definition Contract v1 — D-003, R-011, R-012
- TD-014 — runtime execution enforcement (resolved Sprint 8)

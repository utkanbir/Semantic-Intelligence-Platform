# Governance Policy Contract v1

**Status:** Authoritative supplement (Sprint 9)  
**Date:** 2026-06-29  
**Issue:** S9-01 (#140)  
**Architecture references:** ARR-002, ARR-003, ARR-004, DM-010, R-013, API-003  
**Companion:** [SIP_Architecture_Review_Resolution_v1.md](./SIP_Architecture_Review_Resolution_v1.md)

---

## 1. Purpose

Define the **Policy registry contract** that the `governance` module must implement before Sprint 9 **gate = Yes** Governance PRs merge to `develop`.

Binding for:

- `PolicyDefinition` aggregate shape (DM-010)
- Lifecycle per Asset Catalog (ARR-002): Draft → Approved → Active → Retired
- Lightweight policy intent JSON (no rule engine at MVP)
- Minimum REST API for S9-02–S9-05

---

## 2. Scope

| In scope | Out of scope |
|----------|--------------|
| PolicyDefinition registry persistence | Complex rule engine / policy evaluation runtime |
| `/api/v1/policies` CRUD + status | Cross-module enforcement hooks (future) |
| SemanticTransaction on create (S9-05) | MCP external APIs |
| Platform-scoped policies at MVP | Per-application policy ACL matrix |

---

## 3. Aggregate relationship

```
Platform (MVP)
└── PolicyDefinition — 1:N registry rows
    ├── policy_key (unique logical key)
    └── policy_definition (JSON — intent stub)
```

- Policies are **platform-scoped** at MVP (no `application_id` FK).
- Other modules may read Active policies via ports in future sprints; governance owns rows.

---

## 4. PolicyDefinition aggregate (DM-010)

### 4.1 Required fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | UUID | yes | PK |
| `policy_key` | string | yes | Unique (e.g. `d003-product-consumption`) |
| `status` | enum | yes | See §5 |
| `title` | string | yes | Display name |
| `description` | text | no | |
| `created_by` | string | yes | |
| `created_at` | datetime | yes | |
| `updated_at` | datetime | yes | |
| `approved_at` | datetime | no | |
| `activated_at` | datetime | no | |
| `retired_at` | datetime | no | |
| `policy_definition` | JSON | yes | Intent stub |

### 4.2 policy_definition (MVP stub)

```json
{
  "schema_version": "1",
  "intent": "",
  "scope": "platform",
  "rules": [],
  "metadata": {}
}
```

---

## 5. Lifecycle status (ARR-002)

| Value | Meaning |
|-------|---------|
| `Draft` | Editable policy in progress |
| `Approved` | Design/governance approval passed |
| `Active` | Authoritative policy intent for platform |
| `Retired` | Historical; not enforceable |

### 5.1 Transition matrix (MVP)

| From | Allowed targets |
|------|-----------------|
| `Draft` | `Approved` |
| `Approved` | `Active`, `Draft` |
| `Active` | `Retired` |
| `Retired` | *(terminal)* |

---

## 6. Immutability

| Status | `policy_definition` mutable via PATCH? |
|--------|----------------------------------------|
| `Draft`, `Approved`, `Active` | **Yes** |
| `Retired` | **No** |

---

## 7. API (Sprint 9)

| Method | Path | Behavior |
|--------|------|----------|
| `POST` | `/api/v1/policies` | Create; status `Draft` |
| `GET` | `/api/v1/policies` | List; filter by `status` |
| `GET` | `/api/v1/policies/{id}` | Get |
| `PATCH` | `/api/v1/policies/{id}` | Update title, description, definition (if mutable) |
| `PATCH` | `/api/v1/policies/{id}/status` | Lifecycle transition |

Query param for status filter: `policy_status` (not bare `status`).

### Trace

| Field | Value |
|-------|-------|
| `transaction_type` | `policy.created` |
| `resource_type` | `PolicyDefinition` |

---

## 8. Module boundaries

- `governance` owns PolicyDefinition APIs and persistence.
- Business modules do not expose policy CRUD from their APIs.
- No rule evaluation in Sprint 9 — registry and lifecycle only.

---

## 9. Sprint 9 issue mapping

| Issue | Deliverable |
|-------|-------------|
| S9-01 | This contract |
| S9-02 | Domain + migration |
| S9-03 | CRUD API |
| S9-04 | Lifecycle status endpoint |
| S9-05 | SemanticTransaction on create |

---

## 10. References

- SIP Asset Catalog v1 — Policy lifecycle
- Playbook — lightweight Policy intent (DM-010); no complex rule engine at MVP

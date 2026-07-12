# ADR-003: Sandbox and App Runtime Topology

**Status:** Accepted  
**Date:** 2026-07-12  
**Accepted:** 2026-07-12 (PO)  
**Deciders:** Lead Architect, PO  
**Depends on:** ADR-001 (K8s runtime), ARR-001 (workspace namespaces)

---

## Context

Frozen MVP (ARR-001–004) models isolation as:

- **Application** — governed workspace with nine namespace fields on `ApplicationWorkspace`
- **ApplicationWorkspace** — postgres_schema, fuseki_dataset, ontology_namespace, etc.
- **Blank provisioning** (ARR-004) — metadata/namespaces only; no auto-created semantic assets

The v2 conceptual model introduces a deliberate split:

| Concept | Role |
|---------|------|
| **Sandbox** | Concrete instance of the six-layer connector stack (§9.1): per-layer Bağlan/Oluştur choices, chat/routing/Compare target |
| **App** | Purpose-built application bound to **exactly one** Sandbox; Discovery → Blueprint → AgentRun lifecycle |

Today the Console uses **Application** as the user-facing isolation unit. Ontology chat (S38) runs under `/applications/:id/ontology/chat` and writes `application_id` on semantic transactions.

v2 adds:

- Multiple Sandboxes per platform (not necessarily 1:1 with Application)
- `sandbox_id` on every trx_main (§8.1)
- Sandbox-scoped Compare Dashboard metrics
- **Oluştur** mode: platform provisions **dedicated** K8s instances per Sandbox per layer (not shared logical isolation)

This ADR resolves how Sandbox/App relate to existing Application/ApplicationWorkspace without violating ARR-004.

---

## Decision

### 1. Naming and ownership

Introduce **Sandbox** as a **first-class platform aggregate** distinct from Application:

```
Platform
├── Sandbox (NEW) — connector topology + chat/compare runtime boundary
│   └── layer connectors (Ontology, KG, Glossary, Catalog, Semantic Layer, Vector, DB)
└── Application (EXISTING) — governed workspace + Console navigation shell
    └── ApplicationWorkspace (EXISTING) — ARR-001 nine namespaces
```

**App** (v2) maps to the existing **AgentRun + Blueprint + Discovery** trajectory:

- Kademe 1 App ≡ configured AgentRun over a Sandbox chat surface (§11.2)
- Does **not** replace Application entity in MVP Console routing

### 2. Relationship rules

| Rule | Detail |
|------|--------|
| R-SBX-01 | Every Sandbox MAY link to zero or one Application for Console navigation during transition |
| R-SBX-02 | Every App (AgentRun product) binds to **exactly one** Sandbox |
| R-SBX-03 | Chat, Compare Mode, and Semantic Router use **sandbox_id**, not application_id, as primary scope |
| R-SBX-04 | ApplicationWorkspace namespaces (ARR-001) remain authoritative for **relational** isolation; Sandbox Oluştur stacks are **additional** infrastructure bindings stored in Sandbox connector config |
| R-SBX-05 | Sandbox lifecycle: `Draft` → `Active` → `Retired` (aligns with ARR-002 Asset Catalog pattern) |

### 3. ARR-004 preservation

Sandbox creation **must not** auto-materialize:

- Domain ontologies (beyond empty connector targets)
- Knowledge graph curated facts
- Published data products
- Agents

Oluştur mode provisions **empty** technology instances (e.g. blank Fuseki dataset, empty OpenMetadata). Ontology materialization remains governed wizard flows — consistent with ARR-004 and v2 §9.3.

### 4. Migration path

| Phase | Behavior |
|-------|----------|
| Sprint 39–40 | Add nullable `sandbox_id`; default legacy chat to implicit Sandbox derived from Application |
| Sprint 51–53 | Full Sandbox UI (Epic 1); deprecate "Application as pseudo-Sandbox" |
| Console | Dual entry: "Sandboxlar" + "Uygulamalar" (§12.1) |

### 5. Application deprecation and transition (PO directive)

**Application is not removed.** Its role narrows gradually while all existing `application_id`-scoped APIs remain stable.

| Phase | Application role | API / data contract |
|-------|------------------|---------------------|
| **Now → Sprint 40** | Primary Console isolation unit; chat, ontology, discovery under `/applications/:id/*` | All existing routes and `semantic_transactions.application_id` **unchanged**; nullable `sandbox_id` added (ADR-002) |
| **Sprint 41–46** | Coexists with implicit Sandbox mapping (1:1 default: one implicit Sandbox per Application until explicit Sandbox CRUD ships) | New sandbox-scoped routes **additive**; `application_id` remains required on legacy endpoints |
| **Sprint 51–53** | Navigation shell + ARR-001 workspace registry; chat/compare primary scope moves to Sandbox | Legacy `application_id` fields **retained** (nullable where new code paths allow); implicit mapping table or FK `sandbox.application_id` for backward lookup |
| **Post–Sprint 53** | Application = governed workspace + provisioning metadata; not chat/routing boundary | Deprecation **warnings** in OpenAPI/docs for ontology-only chat paths superseded by sandbox-scoped router (ADR-004); **no breaking removal** without explicit ADR + major version |

**Non-breaking rules (mandatory):**

| Rule | Detail |
|------|--------|
| R-APP-T01 | No removal or rename of `applications` module, table, or REST resource paths in this transition |
| R-APP-T02 | Existing clients using `application_id` continue to work through adapter layer that resolves `sandbox_id` internally |
| R-APP-T03 | New features prefer `sandbox_id` but MUST NOT require callers to drop `application_id` until a future major Console release |
| R-APP-T04 | Assessment MVP E2E scenario continues to pass on Application-scoped flows until explicitly migrated in a dedicated sprint |

---

## Constraints

- Do not rename `applications` module or break Assessment MVP E2E scenario without explicit migration plan
- Sandbox Oluştur provisioning requires K8s operators (ADR-001 compatible) — new infra ADR follow-up if operator pattern differs from current base manifests
- D-007 unchanged: Sandbox/K8s concepts stay out of domain ontology

---

## Consequences

### Positive

- Compare Mode and multi-topology experiments (OWL file vs live Neo4j) become first-class
- Clear separation: infrastructure binding (Sandbox) vs governed workspace (Application)

### Negative

- User-facing complexity: Application vs Sandbox vs App terminology must be documented in Console
- Data migration: existing `application_id`-scoped transactions need sandbox mapping

### Conflicts resolved

| Potential conflict | Resolution |
|--------------------|------------|
| ARR-001 nine namespaces vs Sandbox full stack | Coexist: namespaces for app-scoped resources; Sandbox for layer connector config |
| ARR-004 blank workspace | Preserved — Sandbox creates infra shells, not semantic assets |

---

## Alternatives considered

**A. Rename Application → Sandbox** — Rejected. Breaks MVP contracts, Assessment E2E, and ARR-001 field semantics.

**B. Sandbox as ApplicationWorkspace extension only** — Rejected. Insufficient for multi-layer connector matrix and Compare Dashboard scoping.

---

## References

- v2 §9.1–§9.2, §11, §12.1, §12.3–§12.4
- `SIP_User_Stories_Backlog (4).docx` Epic 1, US-6.1
- `docs/architecture/SIP_Architecture_Review_Resolution_v1.md` ARR-001, ARR-004

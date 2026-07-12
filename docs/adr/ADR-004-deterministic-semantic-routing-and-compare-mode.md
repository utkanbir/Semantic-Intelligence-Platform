# ADR-004: Deterministic Semantic Routing and Compare Mode

**Status:** Accepted  
**Date:** 2026-07-12  
**Accepted:** 2026-07-12 (PO — §6 Bare Path SQL Security)  
**Revised:** 2026-07-12  
**Deciders:** Lead Architect, PO  
**Depends on:** ADR-002, ADR-003, ADR-005 (connector ports)

---

## Context

Sprint 38 `POST /api/v1/chat/ontology` implements **ontology-structure-only** Q&A:

- Loads classes/properties/relationships from `ontology_definitions`
- Single LLM call via `LLMPort`
- Six trace steps with Experience/Semantic/Knowledge layers — but **Knowledge** step does not query a live KG; context is ontology JSON only

The v2 model defines the platform's core differentiator:

1. **Deterministic router** (§9.4) — code decides which connectors to invoke; LLM does not freely tool-loop
2. **Context bundle** (§10) — Ontology + KG + Glossary/Catalog + optional Semantic Layer → one final LLM generation (or SQL generation)
3. **Rich path** — full semantic stack
4. **Bare path** — LLM + Database only (realistic SQL agent baseline for comparison)
5. **Compare Mode** (§6) — same question → two simultaneous Semantic Transactions (Rich + Bare) + **Comparison** record + `AnswerCompared` step

This is a **cross-cutting architectural capability** spanning:

- New module or core service (`semantic_routing` / `chat`)
- ontology, knowledge_graph, adapters (ports)
- audit_trace (dual trx + Comparison)
- frontend (live dual panel, Compare Dashboard)

Current MVP explicitly chose **REST-first internal API** (API-002) and **modular monolith** (R-001). Router must not become an autonomous agent framework.

---

## Decision

### 1. Deterministic Semantic Router

Implement routing as a **pure orchestration service** inside the modular monolith:

```
POST /api/v1/chat/...  (sandbox-scoped)
  → SemanticRouterService
      1. Normalize question (Experience)
      2. SemanticRouting (Semantic) — concept match against Sandbox Ontology; NO LLM tool choice
      3. Deterministic connector fan-out (Ontology / KG / Information / Semantic Layer / Data) per concept type (curated vs rule-derived)
      4. Build context bundle (deterministic merge)
      5. Single LLM invocation (Semantic) for answer composition OR SqlGenerated + DatabaseQueried
      6. Persist trx_main + ordered trace_steps (ADR-002)
```

**Rules:**

| Rule | Detail |
|------|--------|
| R-RT-01 | Router selects connectors from **Sandbox layer config** + concept metadata (`curated` vs `rule-derived`) |
| R-RT-02 | No unbounded agent loop; optional **one** bounded "request missing context" retry (§9.4) |
| R-RT-03 | LLM access only via existing `LLMPort` (R-018) |
| R-RT-04 | External systems only via module ports (KG, RelationalDB, ObjectStorage, etc.) |
| R-RT-05 | SQL generation is **single-shot** with pre-resolved mappings — not schema-discovery SQLAgent |

### 2. Compare Mode

Compare Mode is **orchestration policy**, not a separate product:

| Mode | Behavior |
|------|----------|
| **Live** | UI shows dual panels; two trx streams (§12.6) |
| **Silent** | Same dual execution; results → Compare Dashboard only (§6.1) |

Execution model:

1. Create `comparison_id`
2. Fork: `mode=Rich` trx + `mode=Bare` trx (parallel async tasks)
3. On both complete: run **AnswerCompared** comparator → `match_status`
4. Persist **Comparison** row (ADR-002)

Bare path scope (§6.4): may execute real SQL against Database connector under **§6 Bare Path SQL Security** constraints below.

### 3. Module boundaries

| Component | Owner module |
|-----------|--------------|
| HTTP route | `chat` or extend `ontology` only if sandbox-scoped chat stays ontology-owned — **prefer new `chat` module** or `platform_admin` router prefix `/api/v1/chat` |
| SemanticRouterService | New `semantic_routing` service under `core/` or dedicated module |
| Connector invocation | Existing adapter ports; Sandbox config drives which port |
| Trace persistence | `audit_trace` repositories (existing layered write API from S38) |
| Compare Dashboard API | New read endpoints aggregating `comparisons` |

Architecture gate: **Yes** for any PR introducing router + bare SQL path.

### 4. Deprecation of ontology-only chat path

S38 `ontology.question_answered` remains valid for **structure-only** fallback until router ships. Target state:

- `semantic.question_answered` (or sandbox-scoped type) replaces ontology-only type for Rich path
- Taxonomy contract §6.1 updated in same PR as router GA

---

## 6. Bare Path SQL Security (PO directive — mandatory)

Bare path is the highest-risk surface in this ADR. The following constraints are **non-negotiable** for any implementation PR and for PO re-approval.

### 6.1 Read-only execution

| Rule | Detail |
|------|--------|
| R-SQL-01 | Only **SELECT** (and dialect-equivalent read-only constructs) may be executed |
| R-SQL-02 | **DDL blocked:** `CREATE`, `ALTER`, `DROP`, `TRUNCATE`, `RENAME`, index/constraint mutations |
| R-SQL-03 | **DML blocked:** `INSERT`, `UPDATE`, `DELETE`, `MERGE`, `UPSERT`, `COPY … TO/FROM` (write), `CALL`/`EXEC` of mutating procedures |
| R-SQL-04 | Multi-statement batches rejected unless every statement passes static read-only validation |
| R-SQL-05 | `SELECT … INTO`, temp-table creation, and session settings that weaken isolation are rejected |

Validation occurs at **two layers**: (1) static SQL parse / allowlist before execution, (2) database role grants limited to read-only.

### 6.2 Connector-scoped single credential

| Rule | Detail |
|------|--------|
| R-SQL-06 | Bare path uses **one dedicated read-only credential** per Database connector binding, stored in Sandbox connector config — not the platform admin or migration superuser |
| R-SQL-07 | Credential scope is **connector-level**: one Sandbox Database connector → one DB user/role with fixed schema/table visibility |
| R-SQL-08 | No runtime credential elevation, connection string override from LLM output, or per-request identity switching |
| R-SQL-09 | Rich path Database reads (if any) use the **same** read-only connector credential — no separate privileged path for chat |

### 6.3 Schema and object allowlist

| Rule | Detail |
|------|--------|
| R-SQL-10 | Each Database connector declares an explicit **schema/table allowlist** (and optional column denylist for PII) in Sandbox config |
| R-SQL-11 | Generated SQL is rejected if it references objects **outside** the allowlist (including `information_schema` / `pg_catalog` probing beyond minimal dialect needs) |
| R-SQL-12 | Cross-schema joins allowed only when **all** referenced schemas are on the allowlist |
| R-SQL-13 | No dynamic SQL that concatenates user input into identifiers; parameters bound for values only |

### 6.4 Operational safeguards

| Rule | Detail |
|------|--------|
| R-SQL-14 | Query timeout and row-limit caps enforced at connector port |
| R-SQL-15 | Full generated SQL + bind parameters logged in `SqlGenerated` / `DatabaseQueried` trace steps (redacted secrets) |
| R-SQL-16 | Failed security validation → trx `Failed`, no fallback execution |
| R-SQL-17 | Security review + integration tests required before Compare Mode GA (Sprint 47+) |

**Alignment:** Consistent with ADR-005 Database layer Create=No and MCP allowlist principle; extends with executable-SQL-specific enforcement.

---

## Constraints

- Must not violate R-001 (no microservices)
- Must not expose MCP externally (API-001)
- Bare path MUST comply with **§6 Bare Path SQL Security** (read-only, connector-scoped credential, schema allowlist, no DDL/DML)
- Compare Mode 2× cost acknowledged — requires ADR-002 cost fields (S40)
- **PO re-approval required before Sprint 43** — satisfied 2026-07-12 (§6 accepted)

---

## Consequences

### Positive

- Delivers v2 value proposition (semantic vs bare LLM+DB)
- Deterministic traces are auditable and testable (Assessment-style regression possible)

### Negative

- Largest post-MVP engineering block (roadmap Sprint 43–46)
- Security review required for SQL execution path (parameterized, sandbox-scoped credentials)

### Current codebase gap (Fable audit)

| v2 capability | Sprint 38 state |
|---------------|-----------------|
| KG query step | Not implemented |
| Glossary/Catalog | No connectors |
| Semantic Layer | No connectors |
| SQL execution | No chat SQL path |
| Compare Mode | Not implemented |
| Deterministic router | Not implemented |

---

## Alternatives considered

**A. LLM tool-calling agent router** — Rejected by v2 §9.4 (non-deterministic, slow, hard to audit).

**B. Extend OntologyChatService incrementally** — Acceptable as Phase 0 only; router eventually replaces as orchestrator.

---

## References

- v2 §3–§7, §9.4, §10, §12.5–§12.7
- `docs/project/Sprint_39_Plus_Roadmap.md` Sprint 43–50
- `backend/app/modules/ontology/services/ontology_chat_service.py` (current subset)

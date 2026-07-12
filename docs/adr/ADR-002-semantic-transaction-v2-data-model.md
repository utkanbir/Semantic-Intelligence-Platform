# ADR-002: Semantic Transaction v2 Data Model (trx_main / trx_detail / Comparison / Conversation)

**Status:** Accepted  
**Date:** 2026-07-12  
**Accepted:** 2026-07-12 (PO)  
**Deciders:** Lead Architect, PO  
**Supersedes:** Partial extension of S38-01 trace schema only; does not replace R-013/R-014

---

## Context

Sprint 38 landed a **partial** implementation of layered tracing:

- `semantic_transactions`: `status`, `initiated_by`, `participating_assets`, `application_id`
- `trace_steps`: `layer`, `status`, `input_summary`, `output_summary`, `duration_ms`
- `TraceLayer` enum: four values (`ExperienceLayer`, `SemanticLayer`, `KnowledgeLayer`, `OperationalLayer`)

The finalized conceptual model (`SIP_Semantic_Transaction_Routing_Kavramsal_Model_v2`) defines a richer **trx_main / trx_detail** split:

| trx_main (new / clarified) | Current repo |
|----------------------------|--------------|
| `question_text`, `answer_text` | Stored only in trace step summaries (truncated) |
| `started_at`, `completed_at`, `total_duration_ms` | Only `created_at` on transaction; per-step `duration_ms` |
| `mode` (Rich / Bare) | Not modeled |
| `cost_estimate`, `total_cost_estimate` | Not modeled |
| `comparison_id` | Not modeled |
| `conversation_id` | Not modeled |
| `sandbox_id` | Uses `application_id` today |

Additionally:

- **Comparison** entity links Rich + Bare trx pairs (Compare Mode)
- **Conversation** groups multiple trx_main rows in a chat session
- **TraceLayer** expands to six routing layers: Experience / Semantic / Ontology / Knowledge Graph / Information / Data

Sprint 39+ roadmap (S39-01, S40-01, S40-03) already sequences these migrations.

This ADR addresses **persistence and domain shape only**. Routing logic is ADR-004; Sandbox identity is ADR-003.

---

## Decision

Adopt the v2 **Semantic Transaction data model** as the target schema for post-MVP chat and Compare Mode, with backward-compatible Alembic migrations.

### trx_main extensions (nullable / defaulted)

Add to `semantic_transactions`:

- `question_text` (text, nullable)
- `answer_text` (text, nullable)
- `started_at`, `completed_at` (timestamptz, nullable)
- `total_duration_ms` (integer, nullable; derivable from timestamps or sum of steps)
- `mode` (enum/string: `Rich` | `Bare`, nullable)
- `total_cost_estimate` (numeric, nullable)
- `comparison_id` (FK → comparisons, nullable)
- `conversation_id` (FK → conversations, nullable)
- `sandbox_id` (FK → sandboxes, nullable — see ADR-003; until Sandbox lands, may alias or defer FK)

**Retain** existing fields: `transaction_type`, `resource_type`, `resource_id`, `application_id`, `status`, `initiated_by`, `participating_assets`, `created_at`.

### trx_detail

Continue using `trace_steps` as trx_detail. Align step names with taxonomy contract §4.1 (e.g. `SemanticRouting`, `KnowledgeGraphQueried`, `SqlGenerated`, `AnswerCompared`).

Extend `trace_steps`:

- `cost_estimate` (numeric, nullable) — per-step LLM/connector cost

### New tables

**`conversations`**

- `id`, `sandbox_id`, `started_at`, optional `user_id`, metadata JSON

**`comparisons`**

- `id`, `trx_id_rich`, `trx_id_bare`, `match_status` (`Match` | `Mismatch` | `Partial`), `created_at`

**`answer_feedback`** (see ADR-006)

- Deferred to ADR-006 but reserved FK from trx_main

### TraceLayer enum extension

Extend `TraceLayer` without breaking existing values:

| v2 layer | S38 value | Action |
|----------|-----------|--------|
| Experience | `ExperienceLayer` | Keep |
| Semantic | `SemanticLayer` | Keep |
| Ontology | — | **Add** `OntologyLayer` |
| Knowledge Graph | `KnowledgeLayer` | Rename alias or add `KnowledgeGraphLayer`; migrate reads |
| Information | — | **Add** `InformationLayer` (Glossary/Catalog) |
| Data | — | **Add** `DataLayer` (Database/SQL) |
| Operational | `OperationalLayer` | Keep for non-lineage ops |

Existing rows with `KnowledgeLayer` remain valid; new writes use v2 names per taxonomy contract update.

---

## Constraints

| Constraint | Rationale |
|------------|-----------|
| Nullable migrations only until backfill strategy defined | ARR-002 lifecycle; no data loss on `sip-dev` |
| Question/answer on trx_main are **authoritative**; trace step summaries are denormalized hints | Avoid dual-source-of-truth in UI |
| Comparison.match_status lives on **Comparison**, not trx_main | v2 §8.3 — pair property |
| No MCP / router logic in this ADR | ADR-004 |
| Platform operational metadata stays in Postgres audit_trace | v2 §9 scope note aligns with current module |

---

## Consequences

### Positive

- Compare Dashboard, cost observability, and conversation memory have a stable schema anchor
- Sprint 39–41 roadmap items map 1:1 to this ADR
- Trace UI can show trx_main summary without parsing all steps

### Negative

- Migration + contract-sync + taxonomy CI churn across multiple sprints
- `KnowledgeLayer` → `KnowledgeGraphLayer` naming transition needs careful enum handling
- `application_id` vs `sandbox_id` coexistence until ADR-003 resolves topology

### Relationship to ARR-001–004

| ARR | Impact |
|-----|--------|
| ARR-001 | Unchanged — workspace namespaces remain on ApplicationWorkspace |
| ARR-002 | Unchanged — lifecycle enums unaffected |
| ARR-003 | Unchanged — audit_trace module name preserved |
| ARR-004 | **Compatible** — operational audit metadata in Postgres is explicitly allowed by v2 |

---

## Alternatives considered

**A. Keep question/answer only in trace_steps** — Rejected. v2 and Sprint 39 audit require trx_main first-class fields.

**B. Separate trx_main table** — Rejected. Extend existing `semantic_transactions` to avoid duplicate lineage APIs.

---

## References

- `architecture/SIP_Semantic_Transaction_Routing_Kavramsal_Model_v2 (21).docx` §8, §13.3–§13.4
- `docs/project/Sprint_39_Plus_Roadmap.md` S39-01, S40-01, S40-03
- `backend/app/modules/audit_trace/` (S38-01 baseline)

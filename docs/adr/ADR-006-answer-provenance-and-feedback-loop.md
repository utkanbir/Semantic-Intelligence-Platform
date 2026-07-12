# ADR-006: Answer Provenance Certificate and User Feedback Loop

**Status:** Accepted  
**Date:** 2026-07-12  
**Accepted:** 2026-07-12 (PO)  
**Deciders:** Lead Architect, PO  
**Depends on:** ADR-002 (Accepted — trx_main/trx_detail), ADR-004 (Proposed — Rich path traces; Sprint 43+)

---

## Context

v2 §13.2 defines **Answer Provenance Certificate** — an exportable, integrity-signed document derived from trx_main + trx_detail proving:

- Which question was asked and answer returned
- Which ontology concepts and data sources were used
- Timestamp and SHA256 hash over trace records (tamper evidence)

v2 §13.5 defines **User Feedback Loop** — distinct from Compare Mode's automatic Rich/Bare comparator:

- End user marks an answer wrong/right
- `AnswerFeedback` record: trx_id, user, feedback_type, note, created_at
- Feeds governance / ontology improvement workflows (not automatic retraining)

Sprint 38 provides internal audit via semantic transactions and trace steps but:

- No export API or signed certificate format
- No user feedback entity
- Q&A text not on trx_main (ADR-002 addresses storage)

User Stories Backlog Epic 10:

- US-10.2 — Answer provenance certificate
- US-10.5 — Feedback loop

Roadmap: Sprint 41 (certificate + feedback).

---

## Decision

### 1. Answer Provenance Certificate

**Source of truth:** Existing `semantic_transactions` + `trace_steps` only. Certificate is **derived**, never independently editable.

**Certificate generation:**

```
GET /api/v1/semantic-transactions/{id}/provenance-certificate
  → ProvenanceCertificateService
      1. Load trx_main (question, answer, timestamps, sandbox, mode)
      2. Load ordered trace_steps
      3. Extract attributed concepts (from SemanticRouting / Ontology steps)
      4. Extract data sources (KG, DB, Glossary refs from step metadata)
      5. Compute integrity_hash = SHA256(canonical JSON of trx + steps)
      6. Return signed document (JSON or PDF — JSON v1 minimum)
```

**Fields (minimum v1):**

| Field | Source |
|-------|--------|
| certificate_id | Generated UUID / PROV-YYYY-MMDD-seq |
| semantic_transaction_id | trx_main.id |
| question_text, answer_text | trx_main (ADR-002) |
| concepts_used | Parsed from trace step output_summary / structured metadata |
| data_sources | KG dataset, DB connection ref (redacted), ontology version |
| created_at | trx_main.completed_at |
| integrity_hash | SHA256 over canonical payload |

**Non-goals (v1):**

- External PKI / HSM signing (hash integrity only)
- Blockchain anchoring
- Certificate mutation or amendment API

### 2. User Feedback Loop

New table **`answer_feedback`**:

| Column | Type |
|--------|------|
| id | UUID PK |
| semantic_transaction_id | FK → semantic_transactions |
| user_id | string (or FK when auth module matures) |
| feedback_type | enum: `incorrect`, `correct`, `partial`, `other` |
| note | text nullable |
| created_at | timestamptz |

**API:**

```
POST /api/v1/semantic-transactions/{id}/feedback
GET  /api/v1/semantic-transactions/{id}/feedback  (admin/governance)
```

**Rules:**

| Rule | Detail |
|------|--------|
| R-FB-01 | Feedback does **not** mutate trx_main or trace_steps |
| R-FB-02 | Feedback does **not** trigger automatic ontology writes |
| R-FB-03 | Multiple feedback rows per trx allowed (audit trail) |
| R-FB-04 | Distinct from Comparison.match_status (automatic Rich/Bare) |

Future: governance dashboard aggregates feedback → human ontology review queue (out of v1 scope).

### 3. Discover Concepts (§13.1)

**No separate ADR.** Discover Concepts extends ontology wizard source types (BI query logs → candidate concepts). Governed by existing ontology approval flow and ADR-005 Kademe 1–2 principles:

- LLM **proposes** only
- Human approves before ontology write

Roadmap Sprint 42 (US-10.1).

---

## Constraints

- Certificate must work for Rich path minimum; Bare path certificate notes reduced concept attribution
- PII redaction in exported data source connection strings
- Feedback API requires authenticated user context when auth lands

---

## Consequences

### Positive

- Regulatory / audit storytelling without new lineage store
- Closes Epic 10 governance loop with minimal schema

### Negative

- Concept extraction from trace summaries may be lossy until router stores structured metadata on steps
- Hash algorithm versioning needed if trace schema evolves

### ADR requirement assessment

| Capability | ADR required? |
|------------|---------------|
| Certificate | **Yes** (this ADR) — export format + integrity model |
| Feedback | **Yes** (this ADR) — new entity + API boundary |
| Discover Concepts | **No** — ontology module extension under existing governance |

---

## Alternatives considered

**A. Store certificate as immutable row** — Rejected. Duplicates trace data; hash derivation preferred.

**B. Merge feedback into Comparison** — Rejected. Different actors (user vs system) and semantics.

---

## References

- v2 §13.1–§13.2, §13.5
- `SIP_User_Stories_Backlog (4).docx` US-10.1, US-10.2, US-10.5
- `docs/project/Sprint_39_Plus_Roadmap.md` Sprint 41–42

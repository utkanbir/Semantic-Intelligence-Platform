# Sprint 38 — Ontology-Aware Chat with Semantic Transaction Tracing

**Role:** Delivery Manager (PMO)
**Date:** 2026-07-09
**Status:** Active
**Epic:** E-38 (#380)  
**Milestone:** Sprint 38 — Ontology Chat (#41)

---

## 1. Context

Product request: add a chat experience where users ask questions about a selected ontology, grounded only in that ontology's structure (not full RAG, not KG reasoning, not agent orchestration), with every question producing a `SemanticTransaction` and a visible `TraceStep` trace in a side panel.

Before scoping the feature itself, this plan was checked against the current repo state (post Sprint 37) rather than written against the original feature brief alone. Three governance-relevant gaps surfaced that the raw brief did not account for, and one product decision was made up front:

1. **Contract-sync CI will block an undocumented route.** `contract_sync_baseline.json` was frozen at 21 entries by S37-05's test (see `SIP_Sprint36_Second_Audit.md` F-5). `POST /api/v1/chat/ontology` must be documented in an architecture contract in the same PR that ships the route — it cannot be grandfathered.
2. **Taxonomy contract-sync CI will block an undeclared transaction type.** S37-04 added `verify_semantic_lineage_sync.py`, which diffs `trace_audience.SEMANTIC_LINEAGE_TRANSACTION_TYPES` against taxonomy contract §6.1. The brief's `transaction_type = "OntologyQuestionAnswering"` also doesn't match the existing naming convention (all current types are lowercase-dotted, e.g. `ontology.suggestion_reviewed`, `ontology.materialized`) — it must be renamed to `ontology.question_answered` and added to both the code set and §6.1 together.
3. **The data model the brief assumes does not exist yet.** `TraceStep` today has only `id, semantic_transaction_id, step_number, step_type, created_at, message` — no `layer`, `status`, `input_summary`, `output_summary`, or `duration`. `SemanticTransactionRecord` has no `status`, `initiated_by`, or `participating_assets`. The "layer" concept (Experience/Semantic/Knowledge) does not exist anywhere in the codebase or docs today. Decision (confirmed with PO): extend the schema for real via an Alembic migration rather than overload the existing `message` free-text field — the alternative would recreate the exact "structured claim in an unstructured field" pattern the second audit flagged elsewhere.
4. **LLM provider decision (confirmed with PO):** ship with a real provider adapter (not the stub) so chat answers are genuinely grounded, consistent with S37-03's rule that stub output must otherwise be labeled — a chat feature whose answers are always the same canned Invoice/Vendor text would not meet the feature's own success criteria.

This sprint does two things: land the four prerequisite fixes above, then build the chat feature on top of them.

---

## 2. Goal

Ship an ontology-grounded chat interface where every question is a fully-modeled `SemanticTransaction` with a real, typed, multi-field trace — without introducing a new undocumented route, an undeclared transaction type, or a schema shortcut that a future audit would have to flag.

---

## 3. Committed scope

| ID | Title | Surface | Gate | Depends | Issue |
|----|-------|---------|------|---------|-------|
| S38-01 | Alembic migration + domain/ORM model extension: add `layer`, `status`, `input_summary`, `output_summary`, `duration_ms` to `TraceStep`; add `status`, `initiated_by`, `participating_assets` (JSON) to `SemanticTransactionRecord`. Nullable/defaulted so existing rows remain valid. Introduce a `TraceLayer` enum (`ExperienceLayer`, `SemanticLayer`, `KnowledgeLayer`, `OperationalLayer`) in `audit_trace/domain` | Backend / DevOps | Yes* | — | #381 |
| S38-02 | Real LLM provider adapter: implement an OpenAI (or configured-equivalent) adapter behind the existing `LLMPort`; extend `SUPPORTED_LLM_PROVIDERS`; wire API-key/model config; preserve `UnsupportedLLMProviderError` fail-fast for anything still unwired | Backend | Yes* | — | #382 |
| S38-03 | Taxonomy contract update: add `ontology.question_answered` to `SEMANTIC_LINEAGE_TRANSACTION_TYPES` and to taxonomy contract §6.1; document the new `TraceLayer` concept as a formal section in the taxonomy contract (it doesn't exist yet — this sprint defines it, not just references it) | Docs / Backend | No | S38-01 | #383 |
| S38-04 | Contract documentation: add `POST /api/v1/chat/ontology` to `docs/architecture/SIP_Ontology_Definition_Contract_v1.md` (new §8.7 Ontology chat table, same Method/Path/Behavior column format as §8.6) *before or in the same PR as* S38-05, so contract-sync CI has something to match against | Docs | No | — | #384 |
| S38-05 | Backend endpoint `POST /api/v1/chat/ontology`: creates a `SemanticTransaction` (`transaction_type=ontology.question_answered`, `status=Running`), retrieves ontology context (classes/properties/labels/descriptions/relationships), calls `LLMPort` with context + question, persists the 6 trace steps from the brief (`QuestionReceived`/Experience, `IntentAnalysis`/Semantic, `OntologyContextRetrieved`/Knowledge, `LLMResponseGenerated`/Semantic, `AnswerReturned`/Experience, `SemanticTransactionCompleted`/Semantic) with per-step `status`/`input_summary`/`output_summary`/`duration_ms`, and marks the transaction `Completed` or `Failed` | Backend | Yes* | S38-01, S38-02, S38-03, S38-04 | #385 |
| S38-06 | Frontend: Chat tab inside the Application Workspace / Ontology area — ontology selector, chat message panel, and a live Semantic Transaction Trace side panel (transaction id, status, ordered trace steps with layer/status/input-output summary/duration, participating assets incl. ontology + LLM provider) | Frontend | No | S38-05 | #386 |
| S38-07 | Tests + sprint-close hygiene: unit tests for the OpenAI adapter and migration, integration test for the endpoint (happy path + failure path), update `handoff.md` at close (per S37-09), retro/health following the full template, reference this plan and note the up-front governance corrections in §1 | Backend / Frontend / Docs | No | S38-05, S38-06 | #387 |

\* S38-01, S38-02, S38-05: escalate to architecture gate — S38-01 is a schema migration, S38-02 introduces a new external dependency (LLM API), S38-05 is the first cross-cutting endpoint spanning ontology + audit_trace + a new external call.

---

## 4. Sequencing

1. **S38-01** (Backend/DevOps) — schema and `TraceLayer` enum first; everything else models against it
2. **S38-02** (Backend, parallel with S38-01) — LLM adapter has no dependency on the schema work
3. **S38-03 → S38-04** (Docs/Backend) — contract updates land once the schema/enum names are final, before the endpoint PR
4. **S38-05** (Backend) — the endpoint, once schema + adapter + both contract updates exist
5. **S38-06** (Frontend) — needs a working endpoint to build against
6. **S38-07** (last) — tests + close hygiene

---

## 5. Definition of done

- [ ] `TraceStep` and `SemanticTransactionRecord` carry the new fields via a real Alembic migration; existing rows unaffected (S38-01)
- [ ] A real LLM adapter answers questions through `LLMPort`; no provider-specific code in routes/UI; unsupported providers still fail fast (S38-02)
- [ ] `ontology.question_answered` and the `TraceLayer` concept are documented in the taxonomy contract; `verify_semantic_lineage_sync.py` passes (S38-03)
- [ ] `POST /api/v1/chat/ontology` is documented in the Ontology contract §8.7 before/with the code PR; `verify_contract_sync.py` passes without a new baseline entry (S38-04)
- [ ] Asking a question creates a `SemanticTransaction`, persists all 6 trace steps in order with layer/status/summaries, and reaches `Completed` or `Failed` correctly (S38-05)
- [ ] Chat tab shows live trace updates as the request processes, including which ontology and LLM provider were used (S38-06)
- [ ] All new code has unit/integration test coverage; `handoff.md` updated at close; retro follows the full template and documents the up-front contract/schema corrections made before implementation (S38-07)
- [ ] `verify-sprint-close.ps1 -Sprint 38` exit 0, via PR (per S37-01)

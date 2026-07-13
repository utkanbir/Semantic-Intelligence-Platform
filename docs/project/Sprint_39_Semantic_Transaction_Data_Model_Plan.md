# Sprint 39 — Semantic Transaction Data Model (trx_main)

**Epic:** E-39 (#396)
**Milestone:** Sprint 39 — Semantic Transaction Data Model (#42)
**Kickoff date:** 2026-07-12
**Facilitator:** PMO (DM hat)
**Architecture basis:** ADR-002 (Accepted) — `docs/adr/ADR-002-semantic-transaction-v2-data-model.md`
**Roadmap:** `docs/project/Sprint_39_Plus_Roadmap.md` §Sprint 39

---

## 1. Up-front governance corrections

- Schema change (trx_main columns) and the `TraceLayer` enum extension are architecture-gated (schema migration + domain contract). Both accepted under ADR-002 which the PO approved before this sprint.
- Contract/taxonomy documentation lands in the same sprint as the schema so `verify_contract_sync.py` and `verify_semantic_lineage_sync.py` stay green.
- All new columns are nullable/defaulted so existing `semantic_transactions` rows remain valid (no backfill required this sprint).

---

## 2. Goal

Complete the §8 Semantic Transaction data model so that every chat transaction carries first-class `question_text`, `answer_text`, timing, and `mode` on **trx_main** (`semantic_transactions`) — not only truncated trace-step summaries — and extend `TraceLayer` to the six-layer routing taxonomy. This is the foundation every later Sprint 40+ capability (cost, conversation, certificate, router, Compare Mode) writes onto.

---

## 3. Committed scope

| ID | Title | Surface | Gate | Depends | Issue |
|----|-------|---------|------|---------|-------|
| S39-01 | Alembic migration adding nullable `question_text`, `answer_text`, `started_at`, `completed_at`, `total_duration_ms`, `mode` to `semantic_transactions`; wire through ORM, domain record, repository mapping, API response schema; add `SemanticTransactionMode` enum (`Rich`/`Bare`) | Backend | Yes* | — | #397 |
| S39-02 | Extend `TraceLayer` enum to the six-layer taxonomy (`OntologyLayer`, `KnowledgeGraphLayer`, `InformationLayer`, `DataLayer`) without breaking existing values; keep legacy `KnowledgeLayer` valid | Backend | Yes* | — | #398 |
| S39-03 | Update `ontology_chat_service.py` to persist full question/answer, timestamps, duration, and `mode=Rich` on trx_main; keep trace step summaries as denormalized hints | Backend | No | #397 | #399 |
| S39-04 | Document trx_main first-class fields (§9.1) and the six-layer `TraceLayer` taxonomy (§4.1) in the taxonomy/eligibility contract; keep contract-sync + lineage-sync CI green | Docs | No | #397 | #400 |
| S39-05 | Tests + sprint-close hygiene: repository/enum/chat-write tests, update `handoff.md`, retro/health following the full template, verify close gates | Backend / Docs | No | #397, #398, #399, #400 | #401 |

\* S39-01, S39-02: escalate to architecture gate — schema migration and domain enum contract change (both under ADR-002).

---

## 4. Sequencing

1. **S39-01** — trx_main columns first; everything models against it
2. **S39-02** (parallel with S39-01) — enum extension, no dependency on the migration
3. **S39-03** — chat service writes, once columns exist
4. **S39-04** — contract/taxonomy docs, once field/enum names are final
5. **S39-05** (last) — tests + close hygiene

---

## 5. Definition of Done

- [ ] Every new `SemanticTransaction` carries `question_text`/`answer_text`/`started_at`/`completed_at`/`total_duration_ms`/`mode` on trx_main (S39-01, S39-03)
- [ ] `TraceLayer` exposes the six-layer taxonomy; existing rows unaffected (S39-02)
- [ ] Taxonomy contract documents trx_main fields and the extended layer set (S39-04)
- [ ] `verify_contract_sync.py` and `verify_semantic_lineage_sync.py` green (S39-04, S39-05)
- [ ] `verify-sprint-close.ps1 -Sprint 39` exit 0, via PR (per S37-01)

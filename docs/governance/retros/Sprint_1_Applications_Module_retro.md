# Sprint Retrospective — Sprint 1

**Date:** 2026-06-28  
**Sprint:** Sprint 1 — Applications Module  
**Facilitator:** PMO (DM hat)  
**Attendees:** Product Owner, Lead Architect, Engineering offices, QA

---

## 1. Committed vs delivered

| Issue | Title | Committed | Delivered | Notes |
|-------|-------|-----------|-----------|-------|
| #30 | S1-01 SQLAlchemy session + readiness DB check | Yes | Done | PR #32 |
| #31 | S1-02 ApplicationWorkspace provisioning contract | Yes | Done | PR #34 — architecture addendum |
| #35 | S1-03 Application and ApplicationWorkspace domain models | Yes | Done | PR #36 — Architect REQUEST CHANGES → fixed |
| #37 | S1-04 Application CRUD API and blank workspace | Yes | Done | PR #40 — slug collision guard |
| #38 | S1-05 Application lifecycle states | Yes | Done | PR #41 |
| #39 | S1-06 SemanticTransaction stub on create | Yes | Done | PR #42 |
| #29 | E-02 Application & workspace management (epic) | Yes | Done | All children delivered |

**Delivery rate:** 6/6 committed implementation issues delivered; epic E-02 complete.

---

## 2. What went well

- First **gate = Yes** domain module landed with Architect review on Applications PRs — R-001 boundaries enforced (ORM moved out of domain after #36 review).
- **ApplicationWorkspace provisioning contract** (`SIP_ApplicationWorkspace_Provisioning_Contract_v1.md`) published before implementation; nine ARR-001 namespace fields and ARR-004 blank-workspace rules implemented.
- **46 pytest** green on `develop` — CRUD, lifecycle transitions, SemanticTransaction on create.
- **Ports & Adapters** pattern held: `TraceRecorder` port + `SqlAlchemyTraceRecorderAdapter`; applications service does not import audit_trace ORM directly from routes layer incorrectly.
- Solo maintainer flow stable: **required reviews = 0**, CI (`Backend CI`, `Kustomize CI`) required.
- Board hygiene script (`fix-project-board.ps1`) and `gh project` scope resolved from Sprint 0 carry-over.

---

## 3. What did not go well

- **Architect gate caught real defects** — ORM in `domain/models.py` (#36) and slug normalization collision `foo-bar` vs `foo_bar` (#40); extra iteration cost but correct outcome.
- **Sprint 1 clarification ADRs** (auth stub, trace orchestration, Ontology/KG DM) not accepted in-sprint — deferred with explicit PO sign-off (see deferral doc).
- **Board Workflow Status** still required batch script at sprint close; per-merge PMO updates not fully automated.
- **Local `develop` divergence** after parallel merges — required merge pull before close.
- **Domain events** on Application create not emitted yet — only SemanticTransaction stub; orchestration ADR deferred.

---

## 4. Governance observations (v1.0)

| # | Question | Answer |
|---|----------|--------|
| 1 | Did Decision Authority Matrix clarify who decided? | **Yes** — provisioning contract and lifecycle matrix in architecture addendum; deferral doc for ADR backlog |
| 2 | Did Architect review only gated PRs? | **Yes** — infra/docs PR #34 gate = No; module PRs gate = Yes |
| 3 | Did PMO avoid writing production code? | **Yes** — Backend subagent delivered module; PMO coordinated merges and governance |
| 4 | Did Backend avoid architecture decisions? | **Yes** — implemented against published contract; escalations via Architect review |
| 5 | Was at least one PR escalated correctly? | **Yes** — #36 REQUEST CHANGES for domain/ORM boundary |
| 6 | Did event-driven architecture gate work? | **Partial** — SemanticTransaction stub only; full event orchestration deferred |

---

## 5. Process change proposals

| Proposal | Affects | Accountable approval | Action |
|----------|---------|----------------------|--------|
| Run `fix-project-board.ps1` after every S1+ merge until GraphQL automation per transition | PMO / playbook | DM | **Adopted** — ongoing |
| Open Sprint 2 milestone issues only after ADR deferral doc merged | PMO | PO | **Done** — this retro |
| Architect checklist: slug/key normalization on any unique constraint | Architect gate template | Lead Architect | **Proposed** — Sprint 2 |

---

## 6. Action items

| Action | Owner | Due | Status |
|--------|-------|-----|--------|
| Close E-02 epic #29 | DM | Sprint close | **Done** |
| Close Sprint 1 milestone | DM | Sprint close | **Done** |
| Merge ADR deferral note with PO sign-off | PO | Sprint close | **Done** |
| Sprint 2 planning — Discovery module issues | PMO | Sprint 2 day 1 | Open |
| Fresh-machine `sip-dev` bootstrap smoke (from S0) | QA | Sprint 2 week 1 | Open |
| Accept or draft ADR: MVP auth stub | Architect | Sprint 2 | Open |

---

## 7. Sprint 2 adjustments

- Begin **Sprint 2 — Discovery Module** per Implementation Guide §17.
- Resolve **Sprint 1 clarification ADR backlog** in parallel docs track before exposing APIs beyond local dev (auth stub priority).
- Applications module remains **gate = Yes** for any follow-up PRs.
- Extend `audit_trace` with TraceStep when orchestration ADR is accepted.

---

## 8. Office perspectives (facilitated retro)

### [Backend]

- **Well:** Full module template; namespace builder deterministic from `key`; lifecycle enum matches ARR-002.
- **Gap:** Physical adapter provisioning (postgres schema, MinIO bucket) still string-only persistence.
- **Sprint 2:** Discovery session aggregate; do not expand applications scope.

### [DevOps]

- **Well:** Alembic migrations chain clean (`0002`–`0004`); readiness checks PostgreSQL.
- **Gap:** Dev secrets still template placeholders (TD-001).
- **Sprint 2:** No Discovery infra blockers expected.

### [QA]

- **Well:** API tests cover happy path, 409 slug collision, lifecycle 422 transitions, trace on create.
- **Gap:** No migration integration test against real PostgreSQL in CI.
- **Sprint 2:** Discovery API contract tests when routes land.

### [Architect]

- **Well:** Gate = Yes effective; provisioning contract authoritative; blank workspace ARR-004 satisfied.
- **Gap:** Trace orchestration and auth undefined for multi-module parallel work.
- **Sprint 2:** ADR acceptance for auth stub and SemanticTransaction orchestration before agent/discovery cross-calls.

---

## 9. Sprint 1 success criteria (workflow §16)

| Criterion | Status |
|-----------|--------|
| Create Application via API | **Met** |
| Blank ApplicationWorkspace with nine namespace fields | **Met** |
| No semantic assets at provision time (ARR-004) | **Met** |
| Application lifecycle transitions (ARR-002) | **Met** |
| SemanticTransaction on significant writes | **Met** (create only; stub) |
| Sprint 1 clarification ADRs Accepted or deferred | **Met** — [deferral doc](../Sprint_1_architecture_clarification_deferral.md) |

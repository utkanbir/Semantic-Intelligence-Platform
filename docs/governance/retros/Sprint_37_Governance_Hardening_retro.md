# Sprint Retrospective — Sprint 37

**Date:** 2026-07-09  
**Sprint:** Sprint 37 — Governance Hardening  
**Kickoff plan:** `docs/project/Sprint_37_Governance_Hardening_Plan.md` *(frozen at sprint start — delivery rate denominator)*  
**Facilitator:** PMO (DM hat)  
**Attendees:** Product Owner, Lead Architect, Engineering offices, QA

**Audit reference:** `SIP_Sprint36_Second_Audit.md` (2026-07-09) — second adversarial governance audit

**Close gates:** `verify-sprint-close.ps1 -Sprint 37` **PASSED** (cluster DB + sip-dev deploy + project board + sprint governance CI via PR merge)

---

## 1. Committed vs delivered

Report against the **kickoff plan** committed scope (§3), not issues added or dropped at close.

| Issue | Title | Committed (kickoff plan) | Delivered | Notes |
|-------|-------|-------------------------|-----------|-------|
| #356 | S37-01 Branch protection + milestone reconcile | Yes | Done | PR #365 |
| #357 | S37-02 Retro delivery-rate gate fix | Yes | Done | PR #368 |
| #358 | S37-03 LLM stub fail-fast + UI disclosure | Yes | Done | PR #370 |
| #359 | S37-04 Taxonomy contract §6.1 + lineage CI | Yes | Done | PR #370 |
| #360 | S37-05 Contract-sync baseline freeze | Yes | Done | PR #377 |
| #361 | S37-06 Ledger expiry + deferral scanner | Yes | Done | PR #368 |
| #362 | S37-07 Gate-11 evidence on Pass rows | Yes | Done | PR #368 |
| #363 | S37-08 Historical doc backfill/waiver | Yes | Done | PR #377 |
| #364 | S37-09 Sprint-close hygiene + main CI | Yes | Done | PR #378 |

**Delivery rate:** 9/9 implementation issues *(exclude epic #355; committed = kickoff plan §3 issue list)*.

**Scope drift:** None. Route-debt tracking issues #371–#376 opened as planned follow-on (Technical Debt Backlog), not in kickoff denominator.

---

## 2. What went well

- **First PR-only sprint close** — S37-01 branch protection blocked direct push; Sprint 37 close lands via PR so Sprint Governance CI can enforce gates.
- **Second-audit carryover closed** — all twelve F-1…F-12 findings mapped to S37-01…S37-09 and delivered.
- **Delivery-rate gate now trustworthy** — `verify_sprint_retro_delivery.py` passes against real Sprint 36 + 37 fixtures; no substring `"done"` false positives.
- **Honest LLM disclosure** — unknown provider raises; Generate UI labels stub output; S34/S35 health corrections annotated.
- **Debt register unified** — `handoff.md` §8 defers to `deferred_items_ledger.json`; expiry enforced at close.

---

## 3. What did not go well

- **CI runner queue** — PR #377 checks cancelled after ~18m queue; required manual re-run before merge.
- **Sprint 36 close path** — predated branch protection; second audit correctly flagged that the governance gate could not block that close.
- **Historical gaps** — Sprint 29/30 backfilled post-hoc; Sprint 33 formally waived (not retroactively invented).

---

## 4. Governance observations (v1.0)

| # | Question | Answer |
|---|----------|--------|
| 1 | Did Decision Authority Matrix clarify who decided? | Yes — PMO owned process gates; architecture gate triaged on S37-03 only |
| 2 | Did Architect review only gated PRs? | Yes — no architecture-gated PRs required escalation this sprint |
| 3 | Did PMO avoid writing production code? | Yes — backend/frontend/infra delegated via engineering offices |
| 4 | Did Backend avoid architecture decisions? | Yes |
| 5 | Was at least one PR escalated correctly? | N/A — no ESCALATE outcomes |
| 6 | Did event-driven architecture gate work? | N/A — no event-bus changes |

---

## 5. Process change proposals

| Proposal | Affects | Accountable approval | Action |
|----------|---------|----------------------|--------|
| None this sprint | — | — | Playbook §6 updated in S37-09 |

---

## 6. Action items

| Action | Owner | Due |
|--------|-------|-----|
| Burn down route-debt issues #371–#376 | Backend / Docs | Technical Debt Backlog |
| Wire real LLM provider (TD-022 #369) | Backend | Sprint 42 expiry |
| Shrink `contract_sync_baseline.json` as contracts absorb routes | Backend | Ongoing |

---

## 7. Sprint 38 adjustments

- PO to prioritize Technical Debt Backlog (#39) vs next product sprint.
- Continue PR-only sprint closes; first close held to `handoff.md` update gate (S37-09).
- Monitor `main` branch CI now that workflows trigger on `main` PRs.

---

## 9. Sprint 37 success criteria

| Criterion | Status |
|-----------|--------|
| Direct push blocked; sprint close via PR (S37-01) | **Met** |
| Delivery-rate gate passes real fixtures (S37-02) | **Met** |
| LLM stub disclosed; fail-fast on unknown provider (S37-03) | **Met** |
| Taxonomy §6.1 complete; lineage sync CI (S37-04) | **Met** |
| Baseline freeze test; route issues tracked (S37-05) | **Met** |
| Ledger expiry + TD-019/TD-021 seeded (S37-06) | **Met** |
| Gate-11 Pass rows cite evidence (S37-07) | **Met** |
| Sprint 29/30 backfill; Sprint 33 waiver (S37-08) | **Met** |
| handoff.md gate + main CI + debt register (S37-09) | **Met** |
| `verify-sprint-close.ps1 -Sprint 37` via PR | **Met** |

---

## 10. End-user release notes

Generate-from-Sources modunda bilinmeyen LLM sağlayıcısı artık sessizce stub döndürmek yerine hata verir; örnek/stub çıktı UI'da açıkça etiketlenir. Diğer governance değişiklikleri son kullanıcıya görünmez.

---

## 11. Technical deliverables

### REST endpoints

**Yok** — S37-03 davranış değişikliği (`UnsupportedLLMProviderError`); yeni route yok.

### Data models

**Yok**

### Scripts / CI (governance)

| Path | Purpose |
|------|---------|
| `scripts/apply-branch-protection.ps1` | PR-only `develop`/`main` (S37-01) |
| `scripts/verify_sprint_milestone_reconcile.py` | Closed milestone vs `end_of_sprint_*` reconcile |
| `scripts/verify_sprint_retro_delivery.py` | Fixed delivery-rate parsing (S37-02) |
| `scripts/verify_sprint_deferrals.py` | `expires_sprint` enforcement (S37-06) |
| `scripts/verify_health_report_gate11.py` | Evidence links on Pass rows (S37-07) |
| `scripts/verify_semantic_lineage_sync.py` | Code vs taxonomy contract CI (S37-04) |
| `scripts/verify_contract_sync.py` | Baseline freeze guard (S37-05) |
| `scripts/contract_sync_route_debt.json` | 21 grandfathered route groups → #371–#376 |
| `scripts/verify_sprint_close_ci.py` | `handoff.md` close gate (S37-09) |
| `.github/workflows/sprint-milestone-reconcile.yml` | Daily milestone reconcile |
| `.github/workflows/backend-ci.yml` | `main` PR trigger (S37-09) |
| `.github/workflows/frontend-ci.yml` | `main` PR trigger (S37-09) |
| `.github/workflows/kustomize-ci.yml` | `main` PR trigger (S37-09) |

### Reports

| Path | Purpose |
|------|---------|
| `docs/governance/health-reports/Sprint_29_Console_Connectors_UX_v2_health.md` | Post-hoc backfill (S37-08) |
| `docs/governance/health-reports/Sprint_30_Fuseki_Persistence_and_Semantic_Transactions_health.md` | Post-hoc backfill (S37-08) |
| `docs/governance/Sprint_33_Governance_Disposition.md` | Formal waiver (S37-08) |

### Infrastructure

| Item | Detail |
|------|--------|
| Branch protection | `develop` + `main`: PR required, Sprint Governance CI required |
| `sip-dev` | `sip-backend:s53` / `sip-console:s54` (unchanged) |

---

## 12. Database schema

**Yok** — no Alembic revision this sprint.

**Alembic head (cluster):** `20260706_0019` — verified by `verify-sprint-db.ps1 -Sprint 37`.

**Cumulative tables (16):** alembic_version, applications, application_workspaces, semantic_transactions, discovery_sessions, discovery_phase_history, blueprints, asset_records, trace_steps, published_data_products, agent_definitions, ontology_definitions, knowledge_graph_registries, technology_adapters, agent_runs, policy_definitions.

**FK relations (summary):**

- `application_workspaces.application_id` → `applications.id`
- `semantic_transactions.application_id` → `applications.id`
- `discovery_sessions.application_id` → `applications.id`
- `discovery_phase_history.session_id` → `discovery_sessions.id`
- `blueprints.application_id` → `applications.id`
- `asset_records.application_id` → `applications.id`
- `trace_steps.semantic_transaction_id` → `semantic_transactions.id`
- `published_data_products.application_id` → `applications.id`
- `agent_definitions.application_id` → `applications.id`
- `ontology_definitions.application_id` → `applications.id`
- `knowledge_graph_registries.application_id` → `applications.id`
- `technology_adapters.application_id` → `applications.id`
- `agent_runs.agent_definition_id` → `agent_definitions.id`
- `policy_definitions.application_id` → `applications.id`

# Sprint Retrospective — Sprint 34

**Date:** 2026-07-07  
**Sprint:** Sprint 34 — Ontology Creation Flow v2  
**Facilitator:** PMO (DM hat)

**Close gates:** `verify-sprint-close.ps1 -Sprint 34` **PASSED** (cluster DB + sip-dev deploy + project board)

---

## 1. Committed vs delivered

| Issue | Title | Delivered | PR |
|-------|-------|-----------|-----|
| #305 | S34-01 Draft-first ontology lifecycle API (create / validate / materialize split) | Done | #313 |
| #306 | S34-02 Deterministic ontology validation rules expansion | Done | #314 |
| #307 | S34-03 LLM semantic review — structured advisory findings | Done | #318 |
| #308 | S34-04 Unified ontology wizard shell — 7-step shared flow, 3 modes | Done | #315 |
| #309 | S34-05 Manual mode — structured forms, labels, TTL preview | Done | #317 |
| #310 | S34-06 OWL/RDF Import — file + paste, parse review, draft-only | Done | #319 |
| #311 | S34-07 Generate from Sources — extraction pipeline + editable draft | Done | #320 (be), #321 (fe) |
| #312 | S34-08 Review & Run, Approve & Materialize, semantic trace alignment | Done | #322 (be), #323 (fe) |
| #304 | E-34 Epic | Done | All children delivered |

**Delivery rate:** 8/8 implementation issues; epic E-34 complete. URL + CSV/Excel source ingestion (S34-07 stretch) deferred to Sprint 35 as planned.

---

## 2. What went well

- **One shared lifecycle across three entry modes** — Manual, OWL/RDF Import, and Generate from Sources all produce an Ontology Draft first and converge on the same Validate → Connector → Review → Approve → Materialize path.
- **Draft-first contract held** — materialization writes to the graph store only after explicit approval; server-side guards (not just UI) block approve/materialize when blocking validation errors exist.
- **No schema churn** — the entire sprint shipped on the existing `ontology_definitions` model; structured drafts and extraction snapshots live in the definition/metadata payload, keeping migration risk at zero (alembic head unchanged at `20260706_0019`).
- **LLM stays advisory** — semantic review and source extraction access the LLM only through the existing `LLMPort` (R-018); findings never auto-mutate a draft, and LLM-unavailable degrades gracefully to deterministic-only / empty-candidate paths.
- **Clean office split on cross-cutting issues** — S34-07 and S34-08 were delivered backend-first then frontend, each half green independently, avoiding merge churn.

---

## 3. What did not go well

- **Board / issue-close drift** — S34-02 (#306) and S34-04 (#308) were delivered by merged PRs (#314, #315) but their issues never auto-closed and their cards were not moved off Backlog; PMO had to reconcile them (close + set Done) at takeover. Root cause: PR bodies lacked `Closes #NNN` and live board transitions were skipped mid-sprint.
- **Session handoff** — the sprint was picked up mid-flight from a stalled agent window; PMO re-verified merged state (PR #317 green) before continuing, costing some ramp time.
- **Repeated non-auto-close** — several PRs this sprint (#318, #319, #321, #323) also required a manual `gh issue close`, confirming the missing-`Closes` pattern is systemic, not a one-off.

---

## 4. Sprint 35 adjustments

- **Enforce `Closes #NNN` in PR bodies** (or a PR template) so issues auto-close and board Actions fire on merge; stop relying on PMO reconciliation.
- Implement the deferred **Generate from Sources** ingestion: web URL fetch and CSV/Excel parsing (evaluate new ingestion ports — likely an architecture gate).
- Full **LLM suggestion accept/ignore UI** with per-finding actions (S34-03 shipped the API + trace; Console surface still pending).
- Consider relaxing the connector requirement for draft-only Generate mode (a draft with no namespace/prefix does not strictly need a connector until materialize).

---

## 9. Sprint 34 success criteria

| Criterion | Status |
|-----------|--------|
| Three modes enter the same wizard; all end as Draft before materialize | **Met** |
| Manual structured forms + Import paste/file + Generate (committed subset) demonstrable on `sip-dev` | **Met** |
| Deterministic validation + advisory LLM review, errors block / warnings allow | **Met** |
| Trace steps (plan §6) visible on semantic transaction | **Met** |
| Sprint-close gates (cluster DB + deploy + board) | **Met** |

---

## 10. End-user release notes

**Ontology oluşturma artık tek, tutarlı bir sihirbazda üç yol sunuyor.**

- **Elle tanımlama (Manual):** Sınıf, ilişki ve veri özelliklerini formlarla ekleyip düzenleyebilir, canlı TTL önizlemesi görürsünüz.
- **Dosya/metin import (OWL/RDF):** OWL/RDF/TTL dosyası yükleyebilir **veya** metni yapıştırabilirsiniz; içerik ayrıştırılır, sınıf/özellik envanteri gösterilir, siz onaylamadan taslak oluşmaz.
- **Kaynaklardan üretme (Generate):** Dosya, yapıştırılan metin veya mevcut uygulama bilgi kaynağından aday kavram ve ilişkiler çıkarılır; her öneri için kanıt parçacığı gösterilir, üretilen taslağı doğrulamadan önce düzenleyebilirsiniz. (Web URL ve CSV/Excel kaynakları Sprint 35'e bırakıldı.)
- Üç yol da aynı adımları izler: **taslak → doğrulama → connector seçimi → önizleme → onay → graph store'a yazma.** Bloklayan hatalar "Onayla ve Yaz" işlemini engeller; uyarılar geçişe izin verir.
- LLM önerileri yalnızca tavsiye niteliğindedir, ontolojinizi otomatik değiştirmez; LLM erişilemezse akış deterministik doğrulamayla sorunsuz devam eder.

Erişim: **http://console.sip.local** → ilgili uygulamanın **Ontology Studio** ekranı.

---

## 11. Technical deliverables

### REST endpoints

| Path | Notes |
|------|-------|
| `POST /api/v1/ontologies` | Create draft-first ontology (Draft status, no graph write) — S34-01 |
| `POST /api/v1/ontologies/validate` | Deterministic checks + advisory `semantic_review` findings (suggestions/warnings/improvements) — S34-02/03 |
| `POST /api/v1/ontologies/{id}/suggestions/{finding_id}/decision` | Record `accepted`/`ignored` per LLM finding — S34-03 |
| `POST /api/v1/ontologies/generate` | Generate draft from sources (file/paste/knowledge-source) with per-candidate evidence — S34-07 |
| `POST /api/v1/ontologies/import` | Draft-only import (no graph write until materialize) — S34-01/06 |
| `PUT /api/v1/ontologies/{id}/connector` | Select graph-store connector for a draft — S34-08 |
| `PATCH /api/v1/ontologies/{id}/status` | Approve gate; blocked when a stored validation report has blocking errors — S34-08 |
| `POST /api/v1/ontologies/{id}/materialize` | Serialize + write to connector named graph; only when Approved + connector set + validation passed — S34-01/08 |

### Data models

| Item | Notes |
|------|-------|
| `OntologyDefinition` draft payload | Structured classes / object + data properties / relationships, per-entity labels, `metadata.mode` (manual/import/generate) |
| `SemanticReviewFinding` / `SemanticReviewResult` | Advisory findings; never mutate the definition |
| Extraction candidate models | Candidate classes/properties/relationships + `evidence[] = {snippet, source_ref}` |

No new database tables (see §12).

### Semantic trace steps (single transaction per lifecycle, plan §6)

`ModeSelected`, `DraftCreated`, `DeterministicValidationExecuted`, `LLMSemanticReviewExecuted`, `SuggestionAccepted`, `SuggestionIgnored`, `ConnectorSelected`, `OntologyApproved`, `OntologyMaterialized` (all classified as `SEMANTIC_LINEAGE`).

### Frontend

| Item | PR |
|------|-----|
| Unified 7-step ontology wizard shell (3 modes) | #315 |
| Manual structured forms + live TTL preview | #317 |
| OWL/RDF Import — file + paste tabs, parse review inventory, approval gate | #319 |
| Generate from Sources — editable candidate review with evidence | #321 |
| Review & Run summary, TTL preview, Approve & Materialize + redirect | #323 |

### Infrastructure

| Item | Notes |
|------|-------|
| `sip-dev` images | `sip-backend:s51`, `sip-console:s52` |
| Sprint deploy gate manifest | Sprint 34 entry in `sprint_deploy_expectations.json` |
| Sprint DB gate manifest | Sprint 34 entry in `sprint_db_expectations.json` |
| Repo hygiene | `.gitignore` extended (`.tmp/`, local docker-desktop infra fixes) |

### Reports

| Item | Notes |
|------|-------|
| `docs/project/Sprint_34_Ontology_Creation_Flow_Plan.md` | Sprint plan / issue map |
| This retro + Sprint 34 health report | §10–§12 per playbook |

---

## 12. Database schema

**Yok** (no migration this sprint).

**Alembic head:** `20260706_0019` — unchanged from Sprint 33. Cluster parity verified by `verify-sprint-db.ps1 -Sprint 34`.

**Cumulative tables (16):** alembic_version, applications, application_workspaces, semantic_transactions, discovery_sessions, discovery_phase_history, blueprints, asset_records, trace_steps, published_data_products, agent_definitions, ontology_definitions, knowledge_graph_registries, technology_adapters, agent_runs, policy_definitions.

**Relations (unchanged):**
- `semantic_transactions` -> `trace_steps`
- `ontology_definitions.connector_id` -> `technology_adapters.id`

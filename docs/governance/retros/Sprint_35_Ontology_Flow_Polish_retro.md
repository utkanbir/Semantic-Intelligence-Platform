# Sprint Retrospective — Sprint 35

**Date:** 2026-07-08  
**Sprint:** Sprint 35 — Ontology Flow Polish & Generate Extensions  
**Facilitator:** PMO (DM hat)

**Close gates:** `verify-sprint-close.ps1 -Sprint 35` **PASSED** (cluster DB + sip-dev deploy + project board)

---

## 1. Committed vs delivered

| Issue | Title | Delivered | PR |
|-------|-------|-----------|-----|
| #325 | S35-01 PR template with Closes #NNN | Done | #329 |
| #326 | S35-02 LLM semantic review accept/ignore UI | Done | #330 |
| #327 | S35-03 Generate URL + CSV/Excel ingestion | Done | #332 (be), #333 (fe) |
| #328 | S35-04 Generate connector gate relax | Done | #331 |
| #324 | E-35 Epic | Done | All children delivered |

**Delivery rate:** 4/4 implementation issues; epic E-35 complete.

---

## 2. What went well

- **Fast sprint** — all four carryover items from Sprint 34 retro landed in one session; no schema migration.
- **PR template (TD-020) fixed** — S35-01 introduced `.github/pull_request_template.md`; issues #325–#328 auto-closed on merge when PRs included `Closes #NNN`.
- **LLM advisory UX complete** — `SemanticReviewPanel` wires accept/ignore to the S34-03 decision API with per-finding state.
- **Generate sources extended** — URL fetch via new `WebContentPort` (R-018, architect APPROVE on #332); CSV/Excel parsed client-side without new backend deps.
- **Deploy gate held** — `sip-dev` rolled out `sip-backend:s53` / `sip-console:s54` before PO handoff.

---

## 3. What did not go well

- **Sprint 33 milestone lingered** — superseded milestone #35 stayed open until Sprint 35 kickoff; PMO closed duplicate issues at sprint start.
- **Sprint plan doc uncommitted until close** — `Sprint_35_Ontology_Flow_Polish_Plan.md` was created at kickoff but not pushed until `end_of_sprint_35`.
- **Architecture-gated URL ingestion** — required a separate architect pass on backend PR #332 before merge; frontend half waited on rebase.

---

## 4. Sprint 36 adjustments

- Commit sprint plan at kickoff, not only at close.
- Evaluate persisting `trace_audience` on write path (TD-018).
- Consider platform-level ontology creation entry (beyond per-application Ontology Studio).

---

## 9. Sprint 35 success criteria

| Criterion | Status |
|-----------|--------|
| PR template enforces Closes #NNN | **Met** |
| LLM accept/ignore demonstrable in Console | **Met** |
| Generate URL + CSV/Excel on sip-dev | **Met** |
| Generate mode without upfront connector | **Met** |
| Sprint-close gates | **Met** |

---

## 10. End-user release notes

**Ontology oluşturma deneyimi iyileştirildi.**

- Doğrulama adımında LLM önerileri için **Kabul Et / Yoksay** düğmeleri eklendi; öneriler ontolojinizi otomatik değiştirmez.
- **Kaynaklardan üret** modunda artık **web URL** girebilir, **CSV veya Excel** dosyası yükleyebilirsiniz (URL sunucu tarafında getirilir; tablo dosyaları istemcide metne dönüştürülür).
- Generate modu artık başlangıçta graph-store connector seçimi **gerektirmez**; connector materialize öncesi adımda seçilir.
- Manuel ve Import modlarının davranışı değişmedi.

Erişim: **http://console.sip.local** → Ontology Studio.

---

## 11. Technical deliverables

### REST endpoints

| Path | Notes |
|------|-------|
| `POST /api/v1/ontologies/generate` | Extended: `kind: "url"` + `url` field; server resolves via `WebContentPort` before LLM extraction — S35-03 |
| `POST /api/v1/ontologies/{id}/suggestions/{finding_id}/decision` | Consumed by Console accept/ignore UI — S35-02 (API from S34-03) |

### Data models

| Item | Notes |
|------|-------|
| `WebContentPort` | New shared port + `HttpWebContentAdapter` (httpx); 1 MiB fetch cap, 422 on failure |
| `ExtractionSourceKind` | Extended with `"url"` |

No new database tables (see §12).

### Frontend

| Item | PR |
|------|-----|
| PR template + workflow pointer | #329 |
| `SemanticReviewPanel` accept/ignore | #330 |
| Generate URL tab + CSV/Excel client parse | #333 |
| Generate connector gate relax | #331 |

### Infrastructure

| Item | Notes |
|------|-------|
| `sip-dev` images | `sip-backend:s53`, `sip-console:s54` |
| Sprint gate manifests | Sprint 35 entries in db/deploy/board expectations JSONs |

### Reports

| Item | Notes |
|------|-------|
| `docs/project/Sprint_35_Ontology_Flow_Polish_Plan.md` | Sprint plan |
| This retro + Sprint 35 health report | §10–§12 |

---

## 12. Database schema

**Yok** (no migration this sprint).

**Alembic head:** `20260706_0019` — unchanged. Cluster verified by `verify-sprint-db.ps1 -Sprint 35`.

**Cumulative tables (16):** alembic_version, applications, application_workspaces, semantic_transactions, discovery_sessions, discovery_phase_history, blueprints, asset_records, trace_steps, published_data_products, agent_definitions, ontology_definitions, knowledge_graph_registries, technology_adapters, agent_runs, policy_definitions.

**Relations (unchanged):**
- `semantic_transactions` -> `trace_steps`
- `ontology_definitions.connector_id` -> `technology_adapters.id`

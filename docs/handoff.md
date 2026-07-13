# SIP Project Handoff — Current State

**Date:** 2026-07-12  
**Branch:** `develop` (integration)  
**Audience:** PO, new engineers, PMO continuity  
**Maintainer:** Update this document at each sprint close or major milestone.

---

## 1. Executive summary

The **Semantic Intelligence Platform (SIP)** is a modular monolith delivering a governed semantic lifecycle: Applications → Discovery → Blueprints → Assets → Data Products → Ontology & Knowledge Graph → Agents, with full **Semantic Transaction** audit trails.

**Current maturity:** MVP Console and API are live on local Kubernetes (`sip-dev`). Recent delivery: **Sprint 39 — Semantic Transaction Data Model** (trx_main first-class question/answer/timing/mode columns + six-layer `TraceLayer`, ADR-002). Prior: Sprint 38 ontology chat.

**Latest closed sprint:** Sprint 39 — Semantic Transaction Data Model  
**Close gate proof:** `verify-sprint-close.ps1 -Sprint 39` **PASSED** (via sprint close PR merge)

**Post-MVP direction:** ADR-002–006 (Accepted) define the v2 semantic transaction routing model (Sandbox, deterministic router, Compare Mode, connector layers, provenance). Roadmap: `docs/project/Sprint_39_Plus_Roadmap.md`.

---

## 2. Live environment (`sip-dev`)

| Item | Value |
|------|-------|
| Cluster context | `docker-desktop` |
| Namespace | `sip-dev` |
| Console URL | http://console.sip.local |
| API URL | http://api.sip.local |
| Backend image | `sip-backend:s60` |
| Console image | `sip-console:s59` |
| Alembic head | `20260712_0021` |
| DB tables | 16 cumulative (see Sprint 39 retro §12) |

### Verify before PO handoff

```powershell
powershell -File scripts/verify-sprint-close.ps1 -Sprint 39
```

---

## 3. Sprint delivery history (recent)

| Sprint | Theme | Status |
|--------|-------|--------|
| 27 | Ontology Semantic Transaction v1 (unified Connectors) | ✅ Closed |
| 28 | Connector Provisioning v1 | ✅ Closed |
| 29 | Console Connectors UX v2 | ✅ Closed |
| 30 | Fuseki Persistence & Semantic Transactions | ✅ Closed |
| 31 | Ontology Wizard & Semantic Transactions v2 | ✅ Closed |
| 32 | Semantic Transaction Realignment | ✅ Closed |
| 33 | Ontology Unified UX (superseded by 34) | ✅ Closed as duplicate |
| 34 | Ontology Creation Flow v2 (draft-first, 3 modes) | ✅ Closed |
| 35 | Ontology Flow Polish (LLM UI, URL/CSV, PR template) | ✅ Closed |
| 36 | Governance Remediation (sprint-close CI, MVP release) | ✅ Closed |
| 37 | Governance Hardening (branch protection, gate fixes) | ✅ Closed |
| 38 | Ontology Chat (layered trace, chat API + Console tab) | ✅ Closed |
| 39 | Semantic Transaction Data Model (trx_main columns, six-layer TraceLayer) | ✅ Closed |

**Retros:** `docs/governance/retros/`  
**Health reports:** `docs/governance/health-reports/`

---

## 4. What works today (end-user visible)

### Platform Console

- Application-centric navigation (`/applications`)
- Platform hub: Connectors, Governance, Audit Trace, Semantic Transactions
- Per-application: Discovery, Blueprint, Assets, Products, Agents, Agent Runs, Ontology (**Definitions + Chat**), Knowledge Graph, Audit Trace

### Ontology Studio (`/applications/:id/ontology/create`)

Unified **7-step wizard** with three modes:

| Mode | Capabilities |
|------|----------------|
| **Manual** | Structured forms for classes, object/data properties, relationships; live TTL preview |
| **OWL/RDF Import** | File upload or paste; parse inventory; explicit approval before draft |
| **Generate from Sources** | File, paste, knowledge source, **web URL**, **CSV/Excel**; editable candidates with evidence snippets; **stub output labeled**; unknown LLM provider **fails fast** (S37-03) |

**Shared lifecycle:** Draft → Validate (deterministic + advisory LLM) → Connector → Review → Approve → Materialize

**Rules:**
- Deterministic validation **errors block** approve/materialize
- Deterministic **warnings** allow proceed
- Advisory semantic review is **advisory only** — never auto-modifies the ontology; **stub/sample output** until real LLM provider wired (TD-022 #369)
- User can **Accept / Ignore** per LLM **suggestion** (recorded in trace)
- Graph store write happens **only** at Materialize (after Approved + connector set)

### Ontology Chat (`/applications/:id/ontology/chat`) — Sprint 38

- Select an ontology; ask natural-language questions grounded in its structure (classes, properties, relationships)
- Each question creates `ontology.question_answered` Semantic Transaction with six layered trace steps
- Trace side panel shows transaction id, status, layer, summaries, duration, participating assets (ontology + LLM provider)
- LLM via `LLMPort` — configure `SIP_LLM_PROVIDER=openai` + `SIP_LLM_API_KEY` for real answers; stub when unwired

### Connectors

- Unified registry at `/connectors` (`technology_adapters` table)
- Types include `ontology_knowledge_graph`, `object_storage`, `database`, `vector_database`, etc.
- Fuseki + MinIO stacks in `sip-dev` base kustomization

### Semantic Transactions vs Audit Trace

- **Semantic Transactions** (`/semantic-transactions`) — ontology lineage, product/agent evolution
- **Audit Trace** (`/audit-trace`) — all trace records including operational events
- Sprint 32 realigned taxonomy; see `docs/governance/SIP_Semantic_Transaction_Taxonomy_and_Eligibility_Contract.md`

---

## 5. Key API surfaces (ontology — Sprint 34/35)

Base: `/api/v1/ontologies`

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/validate` | Stateless content validation |
| POST | `/` | Create draft-first ontology |
| POST | `/import` | Import → draft (no graph write until materialize) |
| POST | `/generate` | Generate from sources → draft + extraction |
| POST | `/{id}/validate` | Run validation + advisory semantic review on draft |
| POST | `/{id}/suggestions/{finding_id}/decision` | Accept/ignore LLM suggestion |
| PUT | `/{id}/connector` | Select graph-store connector |
| PATCH | `/{id}/status` | Lifecycle transition (e.g. Approved) |
| POST | `/{id}/materialize` | Write to connector named graph |
| POST | `/chat/ontology` | Ontology-grounded Q&A (Sprint 38) |

Full router list: `backend/app/api/v1/router.py`

---

## 6. Repository map

```
sip/
├── architecture/          # Canonical .docx specs (frozen MVP — human authority)
├── backend/               # FastAPI modular monolith
├── frontend/              # React Platform Console
├── infra/                 # Kubernetes + Kustomize (primary runtime)
├── docs/
│   ├── handoff.md         # ← this document
│   ├── architecture/      # Binding supplements + software architecture guide
│   ├── adr/               # Architecture Decision Records
│   ├── governance/        # Process, retros, health reports
│   └── project/           # Playbook, GitHub workflow, sprint plans
├── scripts/               # Sprint gates, board sync, verification
└── .github/               # CI workflows, PR template
```

**Deep dive:** [Software Architecture Guide](architecture/SIP_Software_Architecture_Guide.md)

---

## 7. Architecture principles (summary)

| Rule | Reference |
|------|-----------|
| Modular monolith, Ports & Adapters | R-001, R-002, R-018 |
| REST-first internal API at `/api/v1` | API-002 |
| Modules own their API surface | API-003 |
| Technology only through ports | R-018 |
| SemanticTransaction + TraceStep on significant actions | R-013, R-014 |
| Blueprint before provisioning | Core lifecycle |
| Agents consume Published Data Products | Domain model |

Governance: `docs/governance/SIP_Architecture_Governance_Policy.md`

---

## 8. Known technical debt (active)

**Authoritative register:** [`scripts/deferred_items_ledger.json`](../scripts/deferred_items_ledger.json) — human-readable index in [`docs/governance/SIP_Deferred_Items_Ledger.md`](governance/SIP_Deferred_Items_Ledger.md). Do not duplicate open items here; update the ledger and linked GitHub issues instead.

At sprint close, `verify_sprint_deferrals.py` enforces ledger hygiene and retro/health deferral phrases.

---

## 9. Documentation index (start here)

| Need | Document |
|------|----------|
| **Project state (this doc)** | `docs/handoff.md` |
| **Code layout & principles** | `docs/architecture/SIP_Software_Architecture_Guide.md` |
| **Architecture supplements index** | `docs/architecture/README.md` |
| **Engineering process** | `docs/project/SIP_DEVELOPMENT_PLAYBOOK.md` |
| **GitHub / sprint workflow** | `docs/project/SIP_GITHUB_WORKFLOW.md` |
| **Ontology contract** | `docs/architecture/SIP_Ontology_Definition_Contract_v1.md` (+ § addendum S34) |
| **Connector model** | `docs/architecture/SIP_Semantic_Connector_Supplement_v1.md` |
| **Semantic transaction taxonomy** | `docs/governance/SIP_Semantic_Transaction_Taxonomy_and_Eligibility_Contract.md` |
| **Sprint 39 retro (latest)** | `docs/governance/retros/Sprint_39_Semantic_Transaction_Data_Model_retro.md` |
| **Governance / sprint gates** | `scripts/verify-sprint-close.ps1`, `docs/project/SIP_DEVELOPMENT_PLAYBOOK.md` §6 |
| **Backend local setup** | `backend/README.md` |
| **Cluster deploy** | `infra/README.md` |

---

## 10. Onboarding checklist

1. Read this handoff + [Software Architecture Guide](architecture/SIP_Software_Architecture_Guide.md)
2. Clone repo; checkout `develop`
3. `kubectl config use-context docker-desktop` (or your dev cluster)
4. `kubectl apply -k infra/kubernetes/overlays/dev`
5. Open http://console.sip.local — create an Application, add a Fuseki connector, run Ontology Studio wizard
6. For backend dev: `backend/README.md` (local uvicorn + Alembic)
7. For sprint work: `docs/project/SIP_GITHUB_WORKFLOW.md` + `.github/pull_request_template.md` (**Closes #NNN** required)

---

## 11. Sprint process notes

- **Sprint closes** must merge via PR to `develop` (branch protection — S37-01); `end_of_sprint_<N>:` commit subject triggers Sprint Governance CI.
- **`handoff.md`** must be updated in every sprint close commit (enforced from Sprint 37 — S37-09).
- **Technical debt:** single register at `scripts/deferred_items_ledger.json`; route debt at `scripts/contract_sync_route_debt.json`.
- **Open product deferrals:** TD-018 (#346), TD-019 (#366), TD-021 (#367), TD-022 (#369) — see ledger for `expires_sprint`.

---

## 12. Contact & authority

| Role | Scope |
|------|-------|
| PO | MVP scope, acceptance |
| Lead Architect | Architecture gate, ADRs |
| PMO (DM) | Sprint delivery, board, gates |
| Engineering offices | Backend / Frontend / DevOps implementation |

Decision authority: `docs/governance/SIP_Decision_Authority_and_Lifecycle.md`

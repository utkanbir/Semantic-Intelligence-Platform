# SIP Project Handoff — Current State

**Date:** 2026-07-08  
**Branch:** `develop` (integration)  
**Audience:** PO, new engineers, PMO continuity  
**Maintainer:** Update this document at each sprint close or major milestone.

---

## 1. Executive summary

The **Semantic Intelligence Platform (SIP)** is a modular monolith delivering a governed semantic lifecycle: Applications → Discovery → Blueprints → Assets → Data Products → Ontology & Knowledge Graph → Agents, with full **Semantic Transaction** audit trails.

**Current maturity:** MVP Console and API are live on local Kubernetes (`sip-dev`). The most recent delivery focus is the **unified Ontology Creation Wizard** (Sprint 34–35): three entry modes (Manual, OWL/RDF Import, Generate from Sources), draft-first lifecycle, deterministic validation, advisory semantic review, and materialize-after-approve to a graph-store connector (Fuseki).

**Latest closed sprint:** Sprint 35 — Ontology Flow Polish & Generate Extensions  
**Close gate proof:** `verify-sprint-close.ps1 -Sprint 35` **PASSED**

---

## 2. Live environment (`sip-dev`)

| Item | Value |
|------|-------|
| Cluster context | `docker-desktop` |
| Namespace | `sip-dev` |
| Console URL | http://console.sip.local |
| API URL | http://api.sip.local |
| Backend image | `sip-backend:s53` |
| Console image | `sip-console:s54` |
| Alembic head | `20260706_0019` |
| DB tables | 16 cumulative (see Sprint 35 retro §12) |

### Verify before PO handoff

```powershell
powershell -File scripts/verify-sprint-close.ps1 -Sprint 35
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

**Retros:** `docs/governance/retros/`  
**Health reports:** `docs/governance/health-reports/`

---

## 4. What works today (end-user visible)

### Platform Console

- Application-centric navigation (`/applications`)
- Platform hub: Connectors, Governance, Audit Trace, Semantic Transactions
- Per-application: Discovery, Blueprint, Assets, Products, Agents, Agent Runs, Ontology, Knowledge Graph, Audit Trace

### Ontology Studio (`/applications/:id/ontology/create`)

Unified **7-step wizard** with three modes:

| Mode | Capabilities |
|------|----------------|
| **Manual** | Structured forms for classes, object/data properties, relationships; live TTL preview |
| **OWL/RDF Import** | File upload or paste; parse inventory; explicit approval before draft |
| **Generate from Sources** | File, paste, knowledge source, **web URL**, **CSV/Excel**; editable candidates with evidence snippets |

**Shared lifecycle:** Draft → Validate (deterministic + advisory LLM) → Connector → Review → Approve → Materialize

**Rules:**
- Deterministic validation **errors block** approve/materialize
- Deterministic **warnings** allow proceed
- Advisory semantic review is **advisory only** — never auto-modifies the ontology (stub LLM port until provider wired)
- User can **Accept / Ignore** per LLM **suggestion** (recorded in trace)
- Graph store write happens **only** at Materialize (after Approved + connector set)

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

| ID | Item | Severity |
|----|------|----------|
| TD-018 | `trace_audience` derived at read time; not persisted on write | S3 |
| TD-019 | Ontology lifecycle = multiple SemanticTransaction rows per `resource_id`, not single row | S3 |
| TD-021 | Legacy `.xls` Excel not supported in Generate mode (CSV/XLSX only) | S3 |

See Sprint 35 health report for full register.

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
| **Sprint 35 retro (latest)** | `docs/governance/retros/Sprint_35_Ontology_Flow_Polish_retro.md` |
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

## 11. Sprint 36 candidates (not committed)

From Sprint 35 retro — not yet planned as issues:

- Persist `trace_audience` on write path (TD-018)
- Platform-level ontology creation entry
- LLM accept/ignore for `warning` / `improvement` kinds (today: suggestions only)
- Legacy `.xls` support or explicit UX guidance (TD-021)
- Single-row semantic transaction model evaluation (TD-019)

---

## 12. Contact & authority

| Role | Scope |
|------|-------|
| PO | MVP scope, acceptance |
| Lead Architect | Architecture gate, ADRs |
| PMO (DM) | Sprint delivery, board, gates |
| Engineering offices | Backend / Frontend / DevOps implementation |

Decision authority: `docs/governance/SIP_Decision_Authority_and_Lifecycle.md`

# SIP Software Architecture Guide

**Version:** 1.0  
**Date:** 2026-07-08  
**Status:** Engineering reference (living document)  
**Audience:** Backend, Frontend, DevOps engineers  
**Companion:** [handoff.md](../handoff.md) · frozen MVP specs in `architecture/*.docx`

This guide explains **how the codebase is organized**, **layering rules**, and **where to put new code**. It supplements — but does not replace — canonical architecture documents.

---

## 1. Architectural style

SIP is a **modular monolith** using **Ports & Adapters** (hexagonal architecture):

```
┌─────────────────────────────────────────────────────────┐
│  HTTP (FastAPI routes)          React Console (pages)   │
├─────────────────────────────────────────────────────────┤
│  Services (use cases)            API client + UI state  │
├─────────────────────────────────────────────────────────┤
│  Domain (models, enums, events)  Components + lib       │
├─────────────────────────────────────────────────────────┤
│  Repositories (interfaces)       —                      │
├─────────────────────────────────────────────────────────┤
│  Ports (shared protocols)        —                      │
├─────────────────────────────────────────────────────────┤
│  Infrastructure adapters         —                      │
│  (Fuseki, httpx, LLM stub, DB)                          │
└─────────────────────────────────────────────────────────┘
```

### Non-negotiable rules

1. **Routes → services → domain/repos/ports** — never skip layers.
2. **Domain models** must not import FastAPI, SQLAlchemy sessions, or vendor SDKs.
3. **Modules own their API** — do not expose routes for another module's aggregates.
4. **Technology access only through ports** in `app/shared/ports/` (R-018).
5. **Significant actions** create `SemanticTransaction` + `TraceStep` records (R-013/R-014).

---

## 2. Monorepo layout

| Path | Role |
|------|------|
| `backend/app/` | Python application root |
| `backend/alembic/` | Database migrations |
| `backend/tests/` | Pytest suite (mirrors `app/` structure) |
| `frontend/src/` | React application |
| `infra/kubernetes/` | K8s manifests (base + overlays) |
| `docs/architecture/` | Binding contract supplements (markdown) |
| `docs/governance/` | Process, retros, health reports |
| `scripts/` | Sprint verification, board automation |

---

## 3. Backend (`backend/app/`)

### 3.1 Top-level folders

| Folder | Purpose |
|--------|---------|
| `main.py` | ASGI entry — creates app via `create_app()` |
| `core/` | App factory, settings, cross-cutting config |
| `api/` | Platform-wide HTTP (health); v1 router assembly |
| `modules/` | **Canonical business modules** (one folder per domain) |
| `shared/` | Cross-module types and **port protocols** |
| `infrastructure/` | **Adapters** implementing ports + DB session wiring |

### 3.2 `core/` — application kernel

| File | Role |
|------|------|
| `core/app.py` | `create_app()` — FastAPI instance, mounts `api_v1_router` |
| `core/config.py` | `Settings` from env vars (`SIP_*` prefix) via `get_settings()` |

No business logic belongs here.

### 3.3 `api/v1/` — HTTP assembly

| File | Role |
|------|------|
| `api/v1/router.py` | **Registers all module routers** under `/api/v1` |
| `api/v1/health.py` | `GET /health`, `/health/ready`, `/health/live` |
| `api/v1/services/health_service.py` | Health check logic |

**Pattern:** Each module exposes `app/modules/<name>/api/routes.py`. Register in `router.py` with the path prefix from `SIP_API_Boundary_v1`.

### 3.4 `shared/ports/` — technology abstractions (R-018)

| Port | File | Used for |
|------|------|----------|
| `RelationalDBPort` | `relational_db.py` | PostgreSQL (via SQLAlchemy in practice) |
| `KnowledgeGraphPort` | `knowledge_graph.py` | RDF graph read/write (Fuseki) |
| `ObjectStoragePort` | `object_storage.py` | MinIO / S3-compatible blobs |
| `VectorStorePort` | `vector_store.py` | Qdrant embeddings |
| `LLMPort` | `llm.py` | Advisory text generation (semantic review, extraction) |
| `WebContentPort` | `web_content.py` | HTTP fetch for URL sources (S35) |

Modules depend on **protocols**, not concrete adapters.

### 3.5 `infrastructure/` — adapters and wiring

| File / folder | Role |
|---------------|------|
| `infrastructure/database.py` | SQLAlchemy engine, session factory, `get_db` dependency |
| `adapters/fuseki.py` | `KnowledgeGraphPort` → Apache Fuseki HTTP API |
| `adapters/llm_stub.py` | Deterministic `LLMPort` for dev/test |
| `adapters/llm_resolver.py` | Resolves LLM port from settings |
| `adapters/http_web_content.py` | `WebContentPort` → httpx fetch |
| `adapters/web_content_resolver.py` | Resolves web content port from settings |
| `adapters/knowledge_graph_resolver.py` | Resolves KG port per connector config |
| `adapters/connector_port_resolver.py` | Maps connector records to technology ports |

**Rule:** Vendor SDKs and HTTP clients live **only** under `infrastructure/adapters/`.

### 3.6 `modules/` — canonical modules

Each module follows this template:

```
modules/<name>/
├── api/
│   ├── routes.py      # FastAPI router (HTTP in)
│   └── schemas.py     # Pydantic request/response models
├── domain/
│   ├── models.py      # Aggregates, value objects (pure Python)
│   ├── enums.py       # Status enums, constants
│   └── events.py      # Domain events (optional)
├── services/
│   └── <name>_service.py   # Use cases, orchestration
├── repositories/
│   ├── interfaces.py       # Repository protocols
│   ├── orm_models.py       # SQLAlchemy table mappings
│   └── sqlalchemy_repository.py
└── ports/
    └── interfaces.py    # Module-internal port interfaces (if any)
```

#### Active modules

| Module | Aggregate(s) | API prefix |
|--------|--------------|------------|
| `applications` | Application, ApplicationWorkspace | `/applications` |
| `discovery` | DiscoverySession | `/discovery-sessions` |
| `blueprints` | Blueprint | `/blueprints` |
| `assets` | AssetRecord | `/assets` |
| `audit_trace` | SemanticTransaction, TraceStep | `/audit-traces`, `/semantic-transactions` |
| `products` | PublishedDataProduct | `/products` |
| `agents` | AgentDefinition | `/agents` |
| `ontology` | OntologyDefinition | `/ontologies` |
| `knowledge_graph` | KnowledgeGraphRegistry | `/knowledge-graphs` |
| `adapters` | TechnologyAdapter (Connector) | `/connectors`, `/adapters` |
| `agent_runtime` | AgentRun | `/agent-runs` |
| `governance` | PolicyDefinition | `/policies` |
| `platform_admin` | (bootstrap / admin) | internal |

> **Note:** `modules/semantic_connectors/` is **deprecated** — table dropped in migration `20260704_0018`. Connectors are unified under `adapters`.

### 3.7 Ontology module (Sprint 34–35 focus)

Key services in `modules/ontology/services/`:

| Service | Responsibility |
|---------|----------------|
| `ontology_service.py` | CRUD, lifecycle, import, materialize, validation orchestration |
| `ontology_validation_service.py` | Deterministic structural validation |
| `ontology_semantic_review_service.py` | Advisory LLM review after validation |
| `ontology_generation_service.py` | Generate-from-sources extraction (LLM + URL resolve) |
| `ontology_inventory.py` | Parse inventory (classes, properties) from RDF |
| `rdf_serialization.py` | Structured definition → Turtle for materialize |

Key domain files:

| File | Responsibility |
|------|----------------|
| `domain/models.py` | `OntologyDefinition` aggregate |
| `domain/validation.py` | Validation report, findings |
| `domain/semantic_review.py` | LLM findings (suggestion/warning/improvement) |
| `domain/extraction.py` | Generate-mode candidates + evidence |

### 3.8 Dependency direction

```
routes.py  →  service.py  →  domain/models.py
                ↓
         repositories/interfaces.py  →  sqlalchemy_repository.py  →  orm_models.py
                ↓
         shared/ports/*  ←  infrastructure/adapters/*
```

**Forbidden:** `domain/` importing from `api/`, `infrastructure/`, or FastAPI.

---

## 4. Frontend (`frontend/src/`)

### 4.1 Stack

- React 18 + TypeScript
- Vite (dev server, build)
- React Router v6
- Vitest (unit tests)
- No global state library — component-local state + API calls

### 4.2 Folder structure

| Folder | Purpose |
|--------|---------|
| `api/` | Typed HTTP client functions (`ontologies.ts`, `applications.ts`, …) |
| `components/` | Reusable UI (shells, wizard panels, timelines) |
| `pages/` | Route-level screens |
| `lib/` | Pure helpers (TTL build, extraction row mapping, CSV parse) |
| `index.css` | Global + wizard styles |

### 4.3 Routing (`App.tsx`)

| Path | Page |
|------|------|
| `/` | Platform overview |
| `/platform` | Platform hub |
| `/connectors` | Connector registry |
| `/semantic-transactions` | Semantic lineage list |
| `/audit-trace` | Full audit trace |
| `/applications` | Application list |
| `/applications/:id/*` | Application shell (nested routes in `ApplicationDetailPage`) |

### 4.4 Application nested routes (`ApplicationDetailPage`)

Includes: discovery, blueprint, assets, products, agents, agent runs, ontologies list, **ontology/create** (wizard), knowledge graphs, audit trace, semantic transactions.

Legacy `/ontology-studio` redirects to `/ontology/create`.

### 4.5 Key ontology UI components

| Component | Role |
|-----------|------|
| `OntologyStudioPage.tsx` | 7-step wizard shell (Manual / Import / Generate) |
| `ManualOntologyDraftEditor.tsx` | Structured manual forms + TTL preview |
| `GeneratedCandidateReview.tsx` | Generate mode editable candidates + evidence |
| `SemanticReviewPanel.tsx` | LLM advisory findings + Accept/Ignore |
| `OntologyValidationInventory.tsx` | Import parse inventory display |
| `SemanticTransactionTimeline.tsx` | Trace step visualization |

### 4.6 API client pattern

`frontend/src/api/ontologies.ts` mirrors backend endpoints. Dev server proxies `/api` → `localhost:8000`. Production uses ingress path `/api/v1`.

---

## 5. Infrastructure (`infra/`)

| Path | Role |
|------|------|
| `kubernetes/base/` | Shared manifests: postgres, backend, console, fuseki, minio |
| `kubernetes/overlays/dev/` | Dev namespace (`sip-dev`), image pins, labels |
| `compose/` | Optional Docker Compose fallback |

**Image pinning:** Dev overlay uses versioned tags (`sip-backend:s53`, `sip-console:s54`) to avoid stale `:dev` cache (TD-016).

**Sprint deploy gate:** `scripts/sprint_deploy_expectations.json` records expected image tags per sprint.

---

## 6. Data layer

- **ORM:** SQLAlchemy 2.x under each module's `repositories/orm_models.py`
- **Migrations:** Alembic in `backend/alembic/versions/`
- **Current head:** `20260706_0019`
- **Tables:** 16 (see latest sprint retro §12)

Applications are logically isolated via workspace namespaces (schema/dataset/collection per app — ARR-001).

---

## 7. Semantic transactions & trace

Every significant ontology action records:

1. A `SemanticTransaction` row (`semantic_transactions` table)
2. One or more `TraceStep` rows (`trace_steps` table)

Ontology creation lifecycle steps (Sprint 34 plan §6):

`ModeSelected` → `DraftCreated` → `DeterministicValidationExecuted` → `LLMSemanticReviewExecuted` → `ConnectorSelected` → `OntologyApproved` → `OntologyMaterialized` (+ `SuggestionAccepted` / `SuggestionIgnored`)

**Note (TD-019):** Steps may span **multiple** transaction rows sharing the same `resource_id` (ontology id), not a single physical transaction row.

---

## 8. Testing

| Area | Location | Runner |
|------|----------|--------|
| Backend unit/API | `backend/tests/` | `pytest` |
| Frontend unit | `frontend/src/**/*.test.tsx` | `vitest` (`npm test`) |
| Kustomize | CI workflow | `kubectl kustomize` build |

---

## 9. CI / quality gates

| Workflow | Trigger | Checks |
|----------|---------|--------|
| Backend CI | PR → `develop` | pytest, ruff, mypy |
| Frontend CI | PR → `develop` | vitest, tsc, vite build |
| Kustomize CI | PR → `develop` | manifest build |
| Project Board Sync | PR open/merge | GitHub Projects v2 status |

PRs must include `Closes #NNN` (see `.github/pull_request_template.md`).

Architecture-gated PRs require Lead Architect review per `docs/governance/SIP_Architecture_Governance_Policy.md`.

---

## 10. Adding a new feature (checklist)

### Backend

1. Identify owning **module** (or propose new module with architecture gate).
2. Add domain types in `domain/`.
3. Implement use case in `services/`.
4. Add repository methods if persistence changes.
5. Expose HTTP in `api/routes.py` + `schemas.py`.
6. Register router in `api/v1/router.py`.
7. If new technology: add port in `shared/ports/`, adapter in `infrastructure/adapters/`.
8. If schema change: Alembic migration + update `scripts/sprint_db_expectations.json`.
9. Tests in `backend/tests/modules/<name>/`.

### Frontend

1. Add API client in `src/api/`.
2. Build page or extend existing wizard in `src/pages/`.
3. Extract reusable UI to `src/components/` or helpers to `src/lib/`.
4. Vitest coverage for new flows.

### DevOps

1. Update `infra/kubernetes/overlays/dev/kustomization.yaml` image tag after sprint merge.
2. Rebuild and rollout before sprint close.
3. Update `scripts/sprint_deploy_expectations.json`.

---

## 11. Further reading

| Topic | Document |
|-------|----------|
| Architecture supplements index | [README.md](./README.md) |
| Ontology lifecycle contract | [SIP_Ontology_Definition_Contract_v1.md](./SIP_Ontology_Definition_Contract_v1.md) |
| Connector model | [SIP_Semantic_Connector_Supplement_v1.md](./SIP_Semantic_Connector_Supplement_v1.md) |
| ARR resolutions | [SIP_Architecture_Review_Resolution_v1.md](./SIP_Architecture_Review_Resolution_v1.md) |
| Project handoff | [handoff.md](../handoff.md) |
| Engineering playbook | [SIP_DEVELOPMENT_PLAYBOOK.md](../project/SIP_DEVELOPMENT_PLAYBOOK.md) |

Canonical frozen specs remain in `architecture/*.docx` at repo root.

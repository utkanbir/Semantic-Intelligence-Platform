# SIP Backend

Python / FastAPI modular monolith for the Semantic Intelligence Platform.

**Architecture reference:** [docs/architecture/SIP_Software_Architecture_Guide.md](../docs/architecture/SIP_Software_Architecture_Guide.md)  
**Project state:** [docs/handoff.md](../docs/handoff.md)

## Local development

From this directory (`backend/`):

```bash
python -m pip install -e ".[dev]"
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Or:

```bash
python -m app.main
```

OpenAPI docs: http://localhost:8000/docs

## Configuration

Settings load from environment variables with the `SIP_` prefix. See `env.example`.

| Variable | Default | Description |
|----------|---------|-------------|
| `SIP_APP_NAME` | `sip-backend` | Service name in health responses |
| `SIP_ENVIRONMENT` | `development` | Runtime environment label |
| `SIP_DEBUG` | `false` | Enable debug mode and auto-reload |
| `SIP_HOST` | `0.0.0.0` | Bind host for uvicorn |
| `SIP_PORT` | `8000` | Bind port for uvicorn |
| `SIP_API_V1_PREFIX` | `/api/v1` | REST API version prefix (API-002) |
| `SIP_LOG_LEVEL` | `info` | Uvicorn log level |
| `SIP_DATABASE_URL` | see `env.example` | PostgreSQL URL for Alembic (`postgresql+psycopg://...`) |

Do not commit `.env` files with secrets.

## Package layout (`app/`)

| Path | Role |
|------|------|
| `main.py` | ASGI entry — calls `create_app()` |
| `core/` | App factory (`app.py`), settings (`config.py`) |
| `api/v1/` | Platform router assembly (`router.py`) + health routes |
| `modules/` | Domain modules (applications, ontology, adapters, …) |
| `shared/ports/` | Cross-cutting port protocols (LLM, KnowledgeGraph, …) |
| `infrastructure/` | Adapters (Fuseki, httpx, DB session, LLM stub) |

Each module under `modules/<name>/` follows:

```
api/           # routes.py, schemas.py
domain/        # models.py, enums.py, events.py
services/      # use-case orchestration
repositories/  # interfaces.py, sqlalchemy_repository.py, orm_models.py
ports/         # module-specific port interfaces (optional)
```

**Layering:** routes → services → domain/repos/ports → infrastructure adapters. Domain must not import FastAPI or SQLAlchemy.

## Active modules (Sprint 35)

| Module | API prefix | Notes |
|--------|------------|-------|
| `applications` | `/applications` | Workspace provisioning entry |
| `discovery` | `/discovery` | Discovery workflows |
| `blueprints` | `/blueprints` | Blueprint lifecycle |
| `assets` | `/assets` | Asset registry |
| `ontology` | `/ontologies` | Draft-first wizard, validate, LLM review, materialize |
| `knowledge_graph` | `/knowledge-graphs` | KG registry |
| `products` | `/data-products` | Published data products |
| `agents` | `/agents` | Agent definitions |
| `agent_runtime` | `/agent-runs` | Agent execution |
| `governance` | `/governance` | Policy definitions |
| `adapters` | `/connectors` | Unified semantic connectors (Fuseki, vector DB, …) |
| `audit_trace` | `/semantic-transactions`, `/audit` | Semantic lineage + operational trace |

Router registration: `app/api/v1/router.py`.

## Database and Alembic

Alembic migrations live under `backend/alembic/`. Current head: **`20260706_0019`** (verify with `alembic heads`).

### Kubernetes (`sip-dev`)

PostgreSQL Service DNS:

```text
sip-postgres.sip-dev.svc.cluster.local:5432
```

Example connection URL (match `sip-postgres-config` / `sip-postgres-secrets` manifests):

```text
postgresql+psycopg://sip_user:<password>@sip-postgres.sip-dev.svc.cluster.local:5432/sip_db
```

Set `SIP_DATABASE_URL` in the backend Deployment environment (or port-forward Postgres locally).

### Commands

From `backend/`:

```bash
pip install -e ".[dev]"
alembic upgrade head          # apply migrations
alembic downgrade -1          # rollback one revision
alembic history               # show revision chain
```

Verify against a running Postgres (local or `kubectl port-forward -n sip-dev svc/sip-postgres 5432:5432`).

## Health endpoints (ADR-001)

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/health` | General health check |
| `GET /api/v1/health/ready` | Kubernetes readiness probe |
| `GET /api/v1/health/live` | Kubernetes liveness probe |

## Tests

From `backend/`:

```bash
pytest
```

Tests mirror `app/` under `backend/tests/`. Ontology wizard, semantic review, and connector flows have dedicated API tests.

## Key ontology endpoints (recent)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/ontologies` | Create manual draft |
| `POST` | `/ontologies/import` | Import OWL/RDF → draft |
| `POST` | `/ontologies/generate` | Generate from sources → draft |
| `POST` | `/ontologies/{id}/validate` | Deterministic + LLM advisory review |
| `PUT` | `/ontologies/{id}/connector` | Bind graph-store connector |
| `POST` | `/ontologies/{id}/approve` | Approve draft |
| `POST` | `/ontologies/{id}/materialize` | Write to Fuseki (after approve) |

See [SIP_Ontology_Definition_Contract_v1.md](../docs/architecture/SIP_Ontology_Definition_Contract_v1.md) § Addendum S34–S35.

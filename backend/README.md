# SIP Backend

Python / FastAPI modular monolith for the Semantic Intelligence Platform.

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

## Database and Alembic (S0-06)

Alembic migrations live under `backend/alembic/`. Initial baseline revision has no domain tables.

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

## Module router registration

Module routers are registered in `app/api/v1/router.py`. See that file for the pattern used when implementing module APIs.

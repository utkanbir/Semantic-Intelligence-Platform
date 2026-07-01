# SIP Infrastructure

Infrastructure for the **Semantic Intelligence Platform (SIP)** monorepo.

## Primary runtime

**Kubernetes + Kustomize** is the **primary** development and deployment runtime for SIP MVP. Local development targets the **`sip-dev`** namespace using manifests under `infra/kubernetes/`.

This is the authoritative path per [ADR-001: Cloud Native Deployment Strategy](../docs/adr/ADR-001-cloud-native-deployment-strategy.md) (Accepted).

Optional Docker Compose (PostgreSQL-only) under `infra/compose/` is **non-authoritative** — see [S0-13 optional fallback](#docker-compose-optional-non-authoritative).

---

## Local Development Guide

### Prerequisites

| Tool | Purpose | Notes |
|------|---------|--------|
| **Kubernetes cluster** | Runtime | Docker Desktop Kubernetes, minikube, kind, or equivalent |
| **kubectl** | Apply manifests | Must match cluster context |
| **Docker** | Build `sip-backend:s14` and `sip-console:s19` images | Required for in-cluster workloads |
| **Python 3.11+** | Backend dev / Alembic | See `backend/README.md` |
| **Ingress controller** (optional) | `api.sip.local`, `console.sip.local` routing | nginx Ingress Controller or Docker Desktop built-in |

Verify cluster access:

```bash
kubectl cluster-info
kubectl get nodes
```

### Namespace: `sip-dev`

The dev overlay (`infra/kubernetes/overlays/dev`) sets `namespace: sip-dev`. Workloads deploy there:

- `sip-backend` — FastAPI (Deployment + Service)
- `sip-console` — Platform Console / React (Deployment + Service + Ingress `console.sip.local`)
- `sip-postgres` — PostgreSQL (StatefulSet + PVC)
- `sip-api` — Ingress for `api.sip.local`

Render manifests (CI also validates this):

```bash
kubectl kustomize infra/kubernetes/overlays/dev
```

### End-to-end bootstrap (Sprint 0)

From the **repository root**:

```bash
# 1. Build images (loaded into cluster Docker context)
docker build -t sip-backend:s14 backend
docker build -t sip-console:s19 frontend

# 2. Deploy stack to sip-dev
kubectl apply -k infra/kubernetes/overlays/dev

# 3. Wait for workloads
kubectl -n sip-dev get pods,svc,ingress,pvc -w
```

For **minikube**, load the image after build:

```bash
minikube image load sip-backend:dev
```

### Ingress hosts

Per [ADR-001](../docs/adr/ADR-001-cloud-native-deployment-strategy.md):

| Host | Purpose | Status |
|------|---------|--------|
| `api.sip.local` | Backend API (`/api/v1/*`) | **Configured** — `infra/kubernetes/base/ingress/api-ingress.yaml` |
| `console.sip.local` | Platform Console (React) | **Configured** — `infra/kubernetes/base/ingress/console-ingress.yaml` |

Add to your hosts file for local ingress testing:

```text
127.0.0.1 api.sip.local
127.0.0.1 console.sip.local
```

On Windows: `C:\Windows\System32\drivers\etc\hosts`  
On macOS/Linux: `/etc/hosts`

Requires a local **ingress controller** reachable on port 80. SIP ingress manifests set `ingressClassName: nginx`. If `console.sip.local` returns connection refused or nginx 404, install the controller once:

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.12.0/deploy/static/provider/cloud/deploy.yaml
kubectl -n ingress-nginx rollout status deployment/ingress-nginx-controller
kubectl apply -k infra/kubernetes/overlays/dev
```

### Health check verification

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/health` | General health |
| `GET /api/v1/health/ready` | Kubernetes readiness probe |
| `GET /api/v1/health/live` | Kubernetes liveness probe |

**Option A — Ingress** (ingress controller running):

```bash
curl -H "Host: api.sip.local" http://127.0.0.1/api/v1/health
curl -H "Host: api.sip.local" http://127.0.0.1/api/v1/health/ready
curl -H "Host: api.sip.local" http://127.0.0.1/api/v1/health/live
```

**Option B — Port-forward** (no ingress required):

```bash
kubectl -n sip-dev port-forward svc/sip-backend 8080:80
curl http://127.0.0.1:8080/api/v1/health
curl http://127.0.0.1:8080/api/v1/health/ready
curl http://127.0.0.1:8080/api/v1/health/live
```

### Platform Console access (S12-04)

The dev overlay pins **`sip-console:s19`** and **`sip-backend:s14`** (see `infra/kubernetes/overlays/dev/kustomization.yaml` `images` section). Rebuild and re-apply after frontend or backend changes:

```bash
docker build -t sip-backend:s14 backend
docker build -t sip-console:s19 frontend
kubectl apply -k infra/kubernetes/overlays/dev
kubectl -n sip-dev rollout status deployment/sip-backend
kubectl -n sip-dev rollout status deployment/sip-console
```

Backend secret template uses `postgresql+psycopg://` (not bare `postgresql://`) so SQLAlchemy loads the `psycopg` driver shipped in the image.

**Option A — Ingress** (ingress controller running; add `console.sip.local` to hosts file — see [Ingress hosts](#ingress-hosts)):

```bash
curl -I -H "Host: console.sip.local" http://127.0.0.1/
```

Open in browser: `http://console.sip.local`

**Option B — Port-forward** (no ingress required):

```bash
kubectl -n sip-dev port-forward svc/sip-console 8080:80
```

Open in browser: `http://127.0.0.1:8080`

The console calls the backend API at `api.sip.local` (ingress) or via a separate backend port-forward on another local port (e.g. `8081`):

```bash
kubectl -n sip-dev port-forward svc/sip-backend 8081:80
```

### Database and Alembic

PostgreSQL in-cluster Service DNS:

```text
sip-postgres.sip-dev.svc.cluster.local:5432
```

Port-forward for local Alembic:

```bash
kubectl -n sip-dev port-forward svc/sip-postgres 5432:5432
```

From `backend/` (see `backend/README.md`):

```bash
export SIP_DATABASE_URL=postgresql+psycopg://sip_user:replace-me@localhost:5432/sip_db
alembic upgrade head
alembic downgrade -1   # verify rollback
```

Replace credentials to match `infra/kubernetes/base/postgres/secret.template.yaml`.

### Sprint-close DB verification

After `alembic upgrade head` on the cluster, PMO must confirm schema parity:

```powershell
powershell -File scripts/verify-sprint-db.ps1 -Sprint <N>
```

Expectations per sprint: `scripts/sprint_db_expectations.json`. Exit 1 blocks milestone close.

### Directory layout

```
infra/
├── kubernetes/
│   ├── base/          # Shared manifests (backend, postgres, ingress, placeholders)
│   └── overlays/
│       ├── dev/       # sip-dev namespace
│       └── prod/      # Production scaffold (future)
├── compose/           # Optional non-authoritative fallback (S0-13)
└── README.md          # This guide
```

Placeholder workloads under `base/` (not yet deployed): `minio/`, `qdrant/`, `fuseki/`, `openmetadata/`.

---

## Docker Compose (optional, non-authoritative)

A minimal PostgreSQL-only Compose file may exist under `infra/compose/` (issue **S0-13**). It is:

- **Not** the primary development path
- **Not** a substitute for the full Kubernetes stack
- **Non-authoritative** per ADR-001

**Do not use Compose as the authoritative runtime model.**

---

## References

- [ADR-001 — Cloud Native Deployment Strategy](../docs/adr/ADR-001-cloud-native-deployment-strategy.md)
- [SIP GitHub Workflow](../docs/project/SIP_GITHUB_WORKFLOW.md) — Sprint 0 issues and acceptance criteria
- [SIP Development Playbook](../docs/project/SIP_DEVELOPMENT_PLAYBOOK.md)
- [Backend README](../backend/README.md) — FastAPI, Alembic, `SIP_*` configuration

# Docker Compose (optional, non-authoritative)

**This directory is not the primary SIP development runtime.**

Per [ADR-001](../../docs/adr/ADR-001-cloud-native-deployment-strategy.md), **Kubernetes + Kustomize** is the authoritative local development path. See [infra/README.md](../README.md).

## When to use

Use this PostgreSQL-only Compose file only when you **cannot** run a local Kubernetes cluster temporarily and need a database for local Alembic or backend work.

## Usage

From this directory:

```bash
docker compose up -d
```

Connection string (matches Kubernetes dev template credentials):

```text
postgresql+psycopg://sip_user:replace-me@localhost:5432/sip_db
```

Stop and remove:

```bash
docker compose down
```

## Limitations

- PostgreSQL only — no backend, ingress, or other platform services
- **Non-authoritative** — do not treat this as a substitute for `sip-dev` on Kubernetes
- Template credentials only (`replace-me`) — not for production or shared environments

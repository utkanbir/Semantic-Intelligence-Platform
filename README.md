# Semantic Intelligence Platform (SIP)

Modular, cloud-native semantic intelligence platform — monorepo for backend, frontend, infrastructure, and documentation.

## Documentation

- [SIP Development Playbook](docs/project/SIP_DEVELOPMENT_PLAYBOOK.md) — engineering process, quality gates, and team conventions
- [SIP GitHub Workflow](docs/project/SIP_GITHUB_WORKFLOW.md) — issue standards, sprint milestones, and delivery workflow
- [ADR-001: Cloud Native Deployment Strategy](docs/adr/ADR-001-cloud-native-deployment-strategy.md) — Kubernetes-first runtime (Accepted)

## Repository layout

| Path | Purpose |
|------|---------|
| `architecture/` | Canonical architecture specifications |
| `backend/` | Python / FastAPI modular monolith |
| `frontend/` | React / TypeScript Platform Console |
| `infra/` | Kubernetes manifests and deployment configuration |
| `docs/` | ADRs, architecture resolutions, and project docs |
| `examples/` | Reference examples |
| `scripts/` | Approved automation scripts |

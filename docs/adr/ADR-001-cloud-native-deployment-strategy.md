# ADR-001: Cloud Native Deployment Strategy for SIP MVP

**Status:** Accepted  
**Date:** 2026-06-25  
**Deciders:** Lead Architect (accepted)

---

## Context

SIP MVP will run multiple platform components over time:

- FastAPI backend (modular monolith)
- React frontend (Platform Console)
- PostgreSQL
- MinIO
- Qdrant
- Apache Fuseki
- OpenMetadata
- Agent runtime
- MCP exposure layer
- Supporting infrastructure (ingress, configuration, secrets)

The current GitHub Workflow (`docs/project/SIP_GITHUB_WORKFLOW.md`) describes **Docker Compose** as the default local development stack. The target development machine already has **Docker Desktop Kubernetes** enabled.

SIP is intended to be a modular, cloud-native semantic platform. Deployment strategy should be clarified **before Sprint 0 infrastructure work begins** so engineers do not invest in Compose as the authoritative runtime model only to migrate to Kubernetes immediately afterward.

This ADR addresses **runtime and deployment architecture only**. It does not change application architecture, domain model, or platform ontology.

---

## Decision

For **SIP MVP**, **Kubernetes** is the **primary development and deployment runtime**.

**Docker Compose** may exist only as an **optional quick-start fallback** for minimal local bootstrap. It is **not** the authoritative runtime model for SIP.

### Implementation guidance

#### Primary runtime

- Use **Kubernetes** as the primary runtime for local development and MVP deployment targets.
- Use namespace **`sip-dev`** for local development.
- Store Kubernetes manifests under **`infra/kubernetes/`**.
- Use **Kustomize** for MVP environment overlays.

#### Directory structure

```
infra/kubernetes/
├── base/
│   ├── backend/
│   ├── frontend/
│   ├── postgres/
│   ├── minio/
│   ├── qdrant/
│   ├── fuseki/
│   ├── openmetadata/
│   └── ingress/
└── overlays/
    ├── dev/
    └── prod/
```

#### Deployment requirements

| Concern | Requirement |
|---------|-------------|
| **Application workloads** | Backend and frontend deploy as Kubernetes **Deployments** |
| **Stateful components** | Use **PersistentVolumeClaims** where persistent storage is required |
| **Configuration** | **ConfigMaps** for non-secret configuration |
| **Credentials** | **Secrets** for sensitive values; no real secrets in manifests |
| **Health** | Backend exposes **health**, **readiness**, and **liveness** endpoints |
| **Discovery** | **Kubernetes Service** resources for internal service discovery |
| **Developer access** | **Ingress** for local developer access where possible |

#### Recommended local hostnames

| Hostname | Purpose |
|----------|---------|
| `api.sip.local` | Backend REST API (`/api/v1`) |
| `console.sip.local` | Platform Console (React frontend) |

#### Docker Compose (optional fallback only)

- May provide `infra/compose/` or equivalent for minimal PostgreSQL-only bootstrap.
- Must be documented as **non-authoritative** and secondary to Kubernetes.
- Must not duplicate the full platform stack as the primary dev path once Kubernetes base manifests exist.

---

## Constraints

The following boundaries are **explicit and non-negotiable**:

| Constraint | Rationale |
|------------|-----------|
| **No microservices in v1** | R-001 modular monolith — one backend Deployment, not per-module services |
| **R-001 modular monolith unchanged** | Kubernetes deploys the monolith; it does not split it |
| **No Kafka in v1** | Domain Events v1 — in-process dispatch + PostgreSQL outbox |
| **Kubernetes not in Platform Ontology** | D-007 — runtime/deployment concepts excluded from semantic ontology |
| **No application designer exposure to K8s** | D-016, D-020 — users interact with Applications, not pods or namespaces |
| **Ports & Adapters remain application integration model** | R-018 — K8s is deployment; adapters integrate technologies at code level |
| **No real secrets in manifests** | Secrets via templates or external secret management; values injected at deploy time |

---

## Consequences

### Positive

- Sprint 0 establishes **production-like deployment discipline** from the start.
- SIP becomes **cloud-native by default**, reducing rework when targeting real clusters.
- Future deployment to staging and production clusters requires **overlay changes**, not architectural redesign.
- **Health checks**, configuration separation, service discovery, and scaling assumptions are introduced early.
- Aligns local development with the team's existing Docker Desktop Kubernetes capability.

### Negative

- Local development is **more complex** than a single `docker compose up` for the full stack.
- Kubernetes manifests require **ongoing maintenance** alongside application code.
- Developers must understand **basic Kubernetes workflow** (`kubectl`, Kustomize, namespace management).
- Initial Sprint 0 infrastructure effort shifts from Compose-first to K8s-first.

### Follow-up tasks

| Task | Owner | Priority |
|------|-------|----------|
| Update `docs/project/SIP_GITHUB_WORKFLOW.md` — Kubernetes as primary Sprint 0 infrastructure path | Tech Lead | Before Sprint 0 start |
| Change Sprint 0 issue **S0-07** from Docker Compose dev stack skeleton to **Kubernetes dev stack skeleton** | Tech Lead | Before Sprint 0 start |
| Keep Docker Compose only as optional fallback (documented, not primary) | Infra | Sprint 0 |
| Add Sprint 0 issue: Kubernetes namespace, base manifests, `dev` overlay, ConfigMaps, Secrets templates, ingress | Infra | Sprint 0 |
| Update `docs/project/SIP_DEVELOPMENT_PLAYBOOK.md` if needed to reference Kubernetes as primary MVP runtime | Tech Lead | After ADR accepted |

**Explicitly out of scope for this ADR:**

- Creating Kubernetes manifests (deferred to Sprint 0 implementation issues)
- Modifying backend or frontend application code
- Changing CI to deploy to a cluster (may follow in a subsequent ADR or Sprint 0 issue)

---

## Architecture alignment

| Decision | Relationship |
|----------|--------------|
| **R-001 — Modular Monolith First** | Unchanged. One backend process deployed as one Deployment (or equivalent); internal module boundaries preserved. |
| **R-003 — Monorepo Structure** | Unchanged. `infra/kubernetes/` lives within the monorepo under `infra/`. |
| **R-018 — Ports & Adapters** | Unchanged. Kubernetes provides network and runtime hosting; technology integration remains in adapter code. |
| **D-007 — Runtime Architecture Separation** | Reinforced. Kubernetes is runtime/deployment architecture, not Platform Ontology. |
| **API-001 — REST Internal, MCP External** | Unchanged. Ingress exposes API and Console; MCP exposure remains external consumption protocol. |
| **ARR-003 — Canonical module structure** | Unchanged. Module folders are unaffected by deployment target. |
| **D-012 — Shared Infrastructure** | Compatible. Kubernetes hosts shared platform infrastructure; applications remain logically isolated via ApplicationWorkspace namespaces (ARR-001). |

---

## Alternatives considered

### Alternative A: Docker Compose as primary runtime (status quo in GitHub Workflow)

**Rejected for MVP.** Compose is simpler initially but diverges from cloud-native target, encourages non-K8s service discovery patterns, and requires a later migration that duplicates Sprint 0 effort.

### Alternative B: Kubernetes for production only; Compose for local dev

**Rejected for MVP.** Maintaining two authoritative runtime models increases drift risk. Compose may remain as optional fallback only.

### Alternative C: Microservices per backend module on Kubernetes

**Rejected.** Violates R-001. Module extraction is a future option; v1 deploys the modular monolith as a single backend workload.

---

## Status history

| Status | Date | Notes |
|--------|------|-------|
| Proposed | 2026-06-25 | Initial ADR for Sprint 0 infrastructure planning |
| Accepted | 2026-06-25 | Accepted by Lead Architect |

---

## References

- `architecture/sip_runtime_architecture_decisions_v1.docx` — R-001, R-003, R-018
- `architecture/SIP Architecture Decision Log.docx` — D-007, D-012
- `architecture/SIP API Boundary v1.docx` — API-001
- `docs/architecture/SIP_Architecture_Review_Resolution_v1.md` — ARR-001, ARR-003
- `docs/project/SIP_DEVELOPMENT_PLAYBOOK.md` — ADR process, release process
- `docs/project/SIP_GITHUB_WORKFLOW.md` — Sprint 0 milestone (pending update per follow-up tasks)

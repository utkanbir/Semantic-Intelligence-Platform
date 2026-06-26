# SIP Infrastructure

Infrastructure for the **Semantic Intelligence Platform (SIP)** monorepo.

## Primary runtime

**Kubernetes + Kustomize** is the **primary** development and deployment runtime for SIP MVP. Local development targets the **`sip-dev`** namespace using manifests under `infra/kubernetes/`.

This is the authoritative path per [ADR-001: Cloud Native Deployment Strategy](../docs/adr/ADR-001-cloud-native-deployment-strategy.md) (Accepted).

## Directory layout

```
infra/kubernetes/
├── base/          # Shared manifests per workload (backend, postgres, ingress, …)
└── overlays/
    ├── dev/       # Local development (sip-dev namespace)
    └── prod/      # Production overlay (future)
```

Build the dev overlay:

```bash
kubectl kustomize infra/kubernetes/overlays/dev
kubectl apply -k infra/kubernetes/overlays/dev   # full stack — S0-07
```

## Docker Compose (optional, non-authoritative)

A minimal Docker Compose fallback for PostgreSQL-only bootstrap may be added later under `infra/compose/` (Sprint 0 issue **S0-13**). It is **not** the primary dev path and must not duplicate the full platform stack once Kubernetes base manifests exist.

**Do not use Compose as the authoritative runtime model.**

## References

- [ADR-001 — Cloud Native Deployment Strategy](../docs/adr/ADR-001-cloud-native-deployment-strategy.md)
- [SIP Development Playbook](../docs/project/SIP_DEVELOPMENT_PLAYBOOK.md)
- [SIP GitHub Workflow](../docs/project/SIP_GITHUB_WORKFLOW.md)

# Sprint Retrospective — Sprint 28

**Date:** 2026-07-03  
**Sprint:** Sprint 28 — Connector Provisioning v1  
**Facilitator:** PMO (DM hat)

**Close gates:** `verify-sprint-close.ps1 -Sprint 28` **PASSED** (cluster DB + project board)

---

## 1. Committed vs delivered

| Issue | Title | Delivered | PR |
|-------|-------|-----------|-----|
| #266 | S28-01 MinIO and Fuseki Kustomize manifests | Done | #269 |
| #267 | S28-02 Connector provision API | Done | #270 |
| #268 | S28-03 Console provision-in-cluster flow | Done | #271 |
| #265 | E-28 Epic | Done | All children delivered |

**Delivery rate:** 3/3 implementation issues; epic E-28 complete.

---

## 2. What went well

- **End-to-end provision path** — K8s vendor stacks + `POST /connectors/{id}/provision` + Console UI (Sprint 27 unified model preserved).
- **No semantic connector regression** — single Connector registry throughout.
- **Fast vertical slice** — infra → backend → frontend in one session.
- **200 tests green** — 196 backend pytest (+8), 190 frontend vitest (+2).

---

## 3. What did not go well

- Backend CI mypy failure on first PR #270 push (TraceRecorder `Sequence` vs `list`) — fixed before merge.
- Provision orchestration is **stub-only** — no real kubectl apply from backend yet.
- Cluster not yet redeployed with MinIO/Fuseki + new console image in this session.

---

## 4. Sprint 29 adjustments

- Deploy sip-dev with MinIO/Fuseki + rebuild console/backend images.
- Real provision orchestration (kubectl/Helm job) vs endpoint stubs.
- Ontology artifact persistence to Fuseki (deferred from S27).

---

## 9. Sprint 28 success criteria

| Criterion | Status |
|-----------|--------|
| MinIO + Fuseki manifests on sip-dev overlay | **Met** |
| Provision API on `/connectors/{id}/provision` | **Met** |
| Console provision-in-cluster enabled | **Met** |
| Unified Connector model (no semantic connector) | **Met** |
| Sprint-close gates | **Met** |

---

## 10. End-user release notes

**Platform Console’da connector oluştururken artık “Provision in cluster” seçeneğini kullanabilirsiniz.**

- **Connectors → Provision in cluster** — Vendor seç, cluster’da endpoint stub’ı ile kayıt oluştur
- MinIO ve Fuseki workload’ları sip-dev manifest’lerine eklendi (DevOps apply sonrası erişilebilir)
- Erişim: **http://console.sip.local** (yeni console image deploy sonrası)

---

## 11. Technical deliverables

### REST endpoints

| Path | Notes |
|------|-------|
| `POST /api/v1/connectors/{id}/provision` | Stub provision; writes `connector_configuration.provision` |

### Infrastructure

| Item | PR |
|------|-----|
| `infra/kubernetes/base/minio/` | #269 |
| `infra/kubernetes/base/fuseki/` | #269 |
| Dev overlay includes vendor stacks | #269 |

### Frontend

| Item | PR |
|------|-----|
| `provisionConnector()` API client | #271 |
| Provision-in-cluster create flow | #271 |

### Reports

**Yok**

---

## 12. Database schema

**Yok** this sprint.

**Alembic head:** `20260704_0018` — unchanged. Cluster verified by `verify-sprint-db.ps1 -Sprint 28`.

**Cumulative tables (16):** unchanged from Sprint 27.

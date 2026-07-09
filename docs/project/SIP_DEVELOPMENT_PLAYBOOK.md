# SIP Development Playbook

**Product:** Semantic Intelligence Platform (SIP)  
**Version:** 1.1  
**Status:** Authoritative — Source of Truth  
**Audience:** Engineering, QA, Architecture, AI-assisted development  
**Scope:** Defines **how SIP is developed**. It does not define platform behavior.

---

## Document Authority

This playbook sits alongside the SIP architecture document set. When engineering process questions arise, consult documents in this order:

1. `architecture/` — platform architecture (`.docx` specifications)
2. `docs/architecture/` — architecture resolutions and supplements (e.g. `SIP_Architecture_Review_Resolution_v1.md`)
3. `docs/adr/` — Architecture Decision Records for implementation-time decisions (e.g. ADR-001 deployment)
4. `docs/governance/` — decision authority, architecture governance policy, retros, health reports
5. **This document** — development process, workflow, and quality gates
6. `docs/project/` — project management supplements

If a development practice conflicts with architecture, **architecture wins**. Escalate through the ADR process (Section 17).

---

## 1. Development Philosophy

SIP is built as a **governed semantic platform**, not a collection of disconnected services. Engineering follows these principles:

### Architecture-first

Implementation conforms to frozen MVP architecture. The modular monolith (R-001), Ports & Adapters model (R-018), and module boundaries defined in `SIP_Implementation_Guide_v1` are non-negotiable for v1.

### Working platform before complete platform

Every sprint delivers capabilities that participate in the end-to-end Semantic Intelligence lifecycle defined in `SIP_MVP_Scope_v0_1`. Isolated proof-of-concept components that do not integrate with Discovery, Blueprint, Provisioning, Products, Agents, or Semantic Transactions are not accepted.

### Blueprint-driven delivery

Features trace to Blueprint capabilities, user journeys (`SIP_Core_User_Journeys_v1`), or MVP success criteria. Work that cannot be mapped to an approved scope item requires explicit approval before starting.

### Explainability by construction

Significant platform actions must produce Semantic Transactions and Trace Steps (R-013, R-014). Engineering tasks that introduce execution paths without traceability are incomplete.

### Technology independence

Business modules depend on ports, not vendors. Direct client calls to MinIO, Fuseki, Qdrant, OpenAI, or similar technologies from services or routes are prohibited (R-018, Implementation Guide §7).

### AI-assisted, human-governed

Cursor and other AI tools accelerate implementation. Humans own architecture compliance, review, merge decisions, and release approval. AI agents implement; they do not redefine architecture.

### Minimal scope, maximal coherence

Prefer a smaller diff that preserves module boundaries and architectural rules over a larger diff that shortcuts layers or introduces parallel patterns.

---

## 2. Project Organization

### Repository layout

SIP uses a **monorepo** (R-003):

```
sip-platform/
├── architecture/          # Canonical architecture specifications (.docx)
├── backend/               # Python / FastAPI modular monolith
├── frontend/              # React / TypeScript Platform Console
├── infra/                 # Kubernetes, Kustomize (primary); optional Compose fallback
├── docs/
│   ├── architecture/      # Architecture resolutions and supplements
│   ├── adr/               # Architecture Decision Records
│   ├── governance/        # Decision authority, architecture governance, org memory
│   └── project/           # This playbook and project docs
├── examples/              # Reference examples
└── scripts/               # Approved automation scripts
```

### Engineering surfaces

| Surface | Path | Primary stack |
|---------|------|---------------|
| Backend | `backend/app/` | Python, FastAPI, SQLAlchemy, Alembic |
| Frontend | `frontend/src/` | React, TypeScript |
| Infrastructure | `infra/` | Kubernetes, Kustomize (ADR-001); optional Compose fallback |
| Documentation | `docs/` | Markdown |

### Canonical backend modules

Backend code is organized under `backend/app/modules/` using **plural folder names** (ARR-003):

`applications`, `discovery`, `blueprints`, `assets`, `ontology`, `knowledge_graph`, `products`, `agents`, `agent_runtime`, `governance`, `adapters`, `audit_trace`, `platform_admin`

Each module follows the template defined in `SIP_Implementation_Guide_v1` §5.

### MVP reference domain

The first application domain is the **Assessment Application** (`SIP_MVP_Scope_v0_1`). Sprint planning and acceptance tests prioritize the MVP demonstration flow unless explicitly expanded by approved scope.

---

## 3. AI Team Roles and Responsibilities

SIP development uses AI assistants as implementation partners. Roles are **functional**, not organizational titles.

### Human roles

| Role | Responsibility |
|------|----------------|
| **Product Owner** | Prioritizes backlog, accepts sprint outcomes, guards MVP scope |
| **Lead Architect** | Owns architecture compliance, ADR approval, freeze exceptions |
| **Tech Lead** | Owns engineering standards, merge policy, release readiness |
| **Engineer** | Implements features, writes tests, participates in review |
| **QA Engineer** | Defines test scenarios, executes QA gates, validates MVP flows |

### AI assistant roles

| Role | Tool context | Responsibility |
|------|--------------|----------------|
| **Backend Implementer** | Backend Cursor chat (`.cursor/rules/sip-backend.mdc`) | Implements backend modules, APIs, domain logic, migrations, tests |
| **Frontend Implementer** | Frontend Cursor chat (dedicated frontend rules) | Implements Platform Console screens per UX specifications |
| **Architecture Analyst** | Read-only / Ask mode | Reviews alignment with architecture; does not invent concepts |
| **Code Reviewer** | PR review, Bugbot / review agents | Checks compliance with playbook, architecture, and module boundaries |
| **Documentation Author** | Docs chats | Updates ADRs, release notes, and approved supplements |

### AI constraints (mandatory)

AI assistants **must not**:

- Introduce new top-level modules without Lead Architect approval
- Replace REST internal communication with MCP (API-001)
- Add Kafka, microservices, or distributed assumptions in v1
- Bypass Ports & Adapters for external technologies
- Create raw database/file access paths for agents (D-003)
- Redefine lifecycle states outside `SIP_Asset_Catalog_v1` (ARR-002)
- Commit secrets, credentials, or environment-specific keys

AI assistants **must**:

- Read `SIP_Implementation_Guide_v1` before writing code
- Respect ARR-001–ARR-004 resolutions
- Produce Semantic Transactions for significant write/execution paths
- Follow the module dependency rules (routes → services → domain/repos/ports → adapters)

---

## 4. Cursor Workspace Organization

### Workspace model

A single repository workspace hosts the SIP monorepo. **Separate Cursor chats** isolate concerns and reduce context pollution.

| Chat | Rules file | Scope |
|------|------------|-------|
| **SIP PMO** | `.cursor/rules/sip-pmo.mdc` | Delivery + engineering coordination; GitHub metadata; no production code |
| **SIP Backend** | `.cursor/rules/sip-backend.mdc` | `backend/**` only |
| **SIP Frontend** | `.cursor/rules/sip-frontend.mdc` (when present) | `frontend/**` only |
| **SIP Architecture** | `.cursor/rules/sip-architecture.mdc` | `architecture/`, `docs/architecture/`, `docs/adr/`, `docs/governance/` — analysis and ADRs only |
| **SIP DevOps** | `.cursor/rules/sip-devops.mdc` | `infra/**`, CI configuration |

Each chat rules file includes an **Authority Contract** (role, mission, authority, cannot). Declare the active PMO hat (Delivery Manager or Engineering Manager) at session start.

### Rules hierarchy

1. Architecture documents (`architecture/`, `docs/architecture/`)
2. `docs/governance/` (decision authority and architecture governance policy)
3. This playbook
4. Cursor rules (`.cursor/rules/*.mdc`)
5. Module-local conventions (only if approved and documented)

### Context discipline

When starting implementation work in Cursor:

1. State the sprint item or GitHub issue ID
2. List affected modules and files
3. Reference relevant architecture decisions (D-*, R-*, DM-*, ARR-*)
4. Confirm the chat matches the surface being edited (backend vs. frontend)

Do not mix backend and frontend implementation in a single backend-scoped chat.

---

## 5. Chat Responsibilities

### Backend chat

**Owns:** API routes, services, domain models, repositories, ports, adapters, Alembic migrations, backend tests.

**Does not own:** React components, console navigation, UX flows, CSS.

### Frontend chat

**Owns:** Platform Console screens per `SIP_Platform_Console_Screen_Map_v1` and `SIP_Platform_Console_UX_v1`, API client integration, frontend tests.

**Does not own:** Backend domain logic, database schema, adapter implementations.

### Architecture chat

**Owns:** Readiness reviews, consistency analysis, ADR drafting, resolution documents.

**Does not own:** Feature implementation or drive-by code changes.

### Cross-surface changes

When a feature spans backend and frontend:

1. Define the API contract first (reference `SIP_API_Boundary_v1`)
2. Implement backend in backend chat; merge or stabilize contract
3. Implement frontend in frontend chat against the agreed contract
4. Track both sides under a single GitHub issue

---

## 6. Git Strategy

### Repository

- **Single monorepo** for backend, frontend, infrastructure, and documentation
- **No secret files** in version control (`.env`, keys, tokens)
- **No generated artifacts** committed unless explicitly required (lock files are required)

### Commit standards

- Commits are **atomic and purposeful** — one logical change per commit when possible
- Commit messages use **imperative mood** and describe *why* when non-obvious:
  ```
  Add ApplicationWorkspace namespace fields per ARR-001

  Persist ontology_namespace and agent_registry_namespace so
  provisioning aligns with the domain model.
  ```
- Reference issue IDs: `Refs #42` or `Closes #42`

### Protected branches

| Branch | Protection |
|--------|------------|
| `main` | Production-ready; requires PR, review, passing CI |
| `develop` | Integration branch; requires PR and CI |

Direct pushes to `main` and `develop` are prohibited.

### Solo maintainer merge policy (Sprint 0 retro)

When the repository has a **single maintainer with write access**:

| Topic | Policy |
|-------|--------|
| Self-approval | **Not possible** on GitHub — the PR author cannot Approve their own PR |
| Review requirement | Set branch protection **required reviews = 0** on `develop` and `main`, then merge via PR without Approve |
| Alternative | Add a second GitHub account as collaborator solely for PR review |
| CI | Keep `Backend CI` and `Kustomize CI` as required status checks |
| Auto-merge | Enable in repo Settings if desired after reviews are configured |

Re-enable **required reviews = 1** when a second human reviewer joins the team.

### What not to commit

- Credentials and `.env` files with secrets
- Local IDE state unrelated to project rules
- Large binary dumps or unapproved architecture exports
- Drive-by refactors unrelated to the issue scope

---

## 7. Branch Strategy

### Branch naming

```
feature/<issue-id>-<short-description>
bugfix/<issue-id>-<short-description>
adr/<short-description>
docs/<short-description>
chore/<short-description>
```

Examples:

- `feature/12-application-workspace-model`
- `bugfix/58-blueprint-status-enum`
- `adr/mvp-authentication-stub`

### Branch lifecycle

1. Branch from `develop` (or `main` for hotfixes per Tech Lead approval)
2. Implement with focused commits
3. Open PR early for visibility
4. Rebase or merge `develop` before final review if the branch is long-lived
5. Delete branch after merge

### Long-lived branches

Avoid long-lived feature branches exceeding **one sprint**. Split work into smaller issues if needed.

---

## 8. GitHub Project Workflow

### Issue types

| Type | Use |
|------|-----|
| **Epic** | Multi-sprint capability (e.g. Blueprint lifecycle) |
| **Feature** | User-visible or API-deliverable unit of work |
| **Task** | Technical subtask |
| **Bug** | Defect against acceptance criteria or architecture rule |
| **ADR** | Architecture decision requiring record |
| **Spike** | Time-boxed investigation; must produce ADR or issue outcomes |

### Issue requirements

Every implementation issue must include:

- **Objective** — what is delivered
- **Architecture references** — D-*, R-*, DM-*, API-*, or ARR-* as applicable
- **Affected modules** — canonical module list
- **Acceptance criteria** — testable statements
- **Out of scope** — explicit exclusions

### Project board columns

| Column | Meaning |
|--------|---------|
| **Backlog** | Prioritized, not ready |
| **Ready** | Meets Definition of Ready |
| **In Progress** | Actively developed |
| **In Review** | PR open, awaiting review |
| **QA** | Merged to `develop`, under test |
| **Done** | Meets Definition of Done |

### Linking

- PR title: `[#issue] Short description`
- PR body: acceptance criteria checklist, architecture refs, test plan
- Close issues via PR keywords when appropriate

### Live board visibility (mandatory)

The [SIP MVP Delivery](https://github.com/users/utkanbir/projects/3) board must reflect **current** work during the sprint — not only at sprint close.

| When | Column | How |
|------|--------|-----|
| Issue added to sprint milestone | **Ready** | Auto: `project-board-sync.yml` on issue open/milestoned |
| Work starts | **In Progress** | PMO: `scripts/set-board-status.ps1 -IssueNumber N -Status "In Progress"` |
| PR opened | **In Review** | Auto: `project-board-sync.yml` (requires `[#N]` in PR title) |
| PR merged to `develop` | **Done** | Auto: `project-board-sync.yml` |

**Reconciliation:** `scripts/fix-project-board.ps1` — drift repair at sprint close only; not the primary update path.

**GitHub Action token (required):** Default `GITHUB_TOKEN` cannot write to user Projects v2. Add repo secret **`PROJECT_SYNC_TOKEN`**.

**Recommended: Classic PAT** (fine-grained tokens often fail on user Project #3 with `Resource not accessible by personal access token`):

1. GitHub → profile menu → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)** → **Generate new token (classic)**
2. Scopes: **`repo`**, **`read:project`**, **`project`**
3. Store in repo: `gh secret set PROJECT_SYNC_TOKEN -R utkanbir/Semantic-Intelligence-Platform`
4. Verify: `GH_TOKEN=<token> python scripts/verify_project_sync_token.py` → must print `OK: token can access project #3` **and** `OK: token can resolve issue node IDs`

**Implementation note:** `scripts/board_sync.py` uses GraphQL `addProjectV2ItemById` (not `gh project item-add`). The CLI command can return misleading `unknown owner type` in Actions while GraphQL mutations succeed with the same PAT (see cli/cli#8885).

**Alternative (fine-grained):** Resource owner = your user account; repository = `Semantic-Intelligence-Platform`; **Account permissions → Projects** Read and write; repository Issues/Pull requests as above. Re-run verify script — if it fails, use Classic PAT instead.

Maintainer local CLI: `gh auth refresh -h github.com -s read:project,project`

---

## 9. Sprint Lifecycle

### Cadence

- **Sprint length:** 2 weeks (default; adjustable by Product Owner)
- **MVP phase:** Sprints follow `SIP_Implementation_Guide_v1` §17 recommended order unless reprioritized by Product Owner with architect sign-off

### Sprint ceremonies

| Ceremony | Purpose |
|----------|---------|
| **Sprint Planning** | Pull Ready items; confirm architecture refs and capacity |
| **Daily Sync** | Blockers, cross-module dependencies, CI status |
| **Architecture Checkpoint** | Mid-sprint review for module boundaries and ADR needs |
| **Sprint Review** | Demo against MVP flow or sprint goals |
| **Retrospective** | Process improvements; playbook/governance updates if approved |
| **Architecture Health Check** | Sprint-end boundary, debt, ADR, gate effectiveness review (see `docs/governance/health-reports/`) |

### End-user release notes (mandatory at sprint close)

At every sprint close, PMO MUST tell the Product Owner (and any end-user audience) **what changed for end users** — people using the Platform Console or Assessment MVP, not engineers.

| Outcome | What to report |
|---------|----------------|
| Console screens, user-visible flows, or externally reachable MVP behavior shipped | Bullet list in plain language (Turkish or English per PO preference) |
| Sprint was backend-only, infra, contracts, or internal API with no Console / no public surface | **"Bu sprintte son kullanıcı için görünür bir değişiklik yok."** |

Record in the sprint retro as **§10 End-user release notes** (even when empty). Do not invent user-facing features from internal API work.

### Technical deliverables summary (mandatory at sprint close)

At every sprint close, PMO MUST list **what was created for technical readers** (PO, architect, integrators) in the sprint retro as **§11 Technical deliverables**. Use **"Yok"** for any category with no new items — do not omit the category.

| # | Category | Include |
|---|----------|---------|
| 1 | **REST / API** | New or changed endpoints (`METHOD /api/v1/...`), MCP tools if any |
| 2 | **Data model** | New domain aggregates, enums, Alembic migrations / tables |
| 3 | **Reports** | New operational or governance reports (retro, health report, exports — not end-user UI) |
| 4 | **Infrastructure** | Kubernetes, Compose, CI workflows, secrets, adapters, new ports |

Keep entries factual (path, table name, PR). Internal-only API counts here; it does not count as end-user release (§10).

### Database schema report (mandatory at sprint close)

At every sprint close, PMO MUST document relational DB changes in the sprint retro as **§12 Database schema**. Use **"Yok"** only if the sprint added no Alembic revision.

| # | Include |
|---|---------|
| 1 | **Migrations this sprint** — revision id(s), linked PR/issue, `upgrade()` summary (new tables, new columns, indexes, constraints) |
| 2 | **Cumulative schema** — all `public` tables after sprint; current Alembic head revision |
| 3 | **Relations** — FK graph (parent → child), notable unique constraints; mermaid `erDiagram` or equivalent bullet list |

Source of truth: `backend/alembic/versions/`. Cross-check with §11 data model bullets; §12 is the authoritative schema/relations view for DB readers.

### Cluster DB verification (mandatory at sprint close)

Before closing the milestone or finalizing retro §12, PMO MUST verify the **`sip-dev` cluster database** matches the sprint — not only `develop` migrations.

```powershell
powershell -File scripts/verify-sprint-db.ps1 -Sprint <N>
```

| Check | Failure means |
|-------|----------------|
| `alembic_version` = expected head for sprint N | Migrations not applied on cluster — **blocker** |
| Sprint **new tables** exist in `public` | Same — retro §12 must not be signed off |
| **Cumulative** tables exist | Partial schema drift |

**On failure:** DevOps runs `alembic upgrade head` against cluster Postgres (see `infra/README.md`), rolls out versioned backend image (`sip-backend:sN`), re-runs verify until exit 0.

**Manifest:** `scripts/sprint_db_expectations.json` — PMO adds sprint entry when landing new migrations.

### sip-dev deploy verification (mandatory at sprint close)

Before closing the milestone or telling the PO the sprint is complete, PMO/DevOps MUST verify the live `sip-dev` frontend/backend workloads are running the sprint's expected images.

```powershell
powershell -File scripts/verify-sprint-deploy.ps1 -Sprint <N>
```

| Check | Failure means |
|-------|----------------|
| Dev overlay pins the expected `sip-backend` / `sip-console` tags | Repo desired state is stale or incomplete |
| Live `sip-dev` deployments use those exact images | Latest sprint UI/API is not actually deployed |
| `kubectl rollout status` succeeds for both deployments | Rollout is incomplete or unhealthy |

**On failure:** rebuild/publish the expected image tag(s), apply `infra/kubernetes/overlays/dev`, wait for rollout, then re-run verify until exit 0.

**Manifest:** `scripts/sprint_deploy_expectations.json` — starting with Sprint 31, add one entry per sprint and carry forward unchanged tags so sprint close always has explicit deploy expectations.

### Sprint close gates and PO handoff (mandatory)

**PMO must not deliver a sprint to the PO** until all gates pass. Partial delivery (code merged but cluster/board drift) is **unacceptable**.

Single entry point:

```powershell
powershell -File scripts/verify-sprint-close.ps1 -Sprint <N>
```

Runs cluster DB verify + `sip-dev` deploy verify + project board verify. **Exit 1 blocks:** retro finalization, milestone close, and any PO message claiming sprint complete.

**Sprint-close order (strict):**

1. CI green on `develop`
2. **`verify-sprint-close.ps1` exit 0** (repair loops until pass — PMO owns this, not PO)
3. Retro §10–§12 + architecture health report (§12 = full table list + cluster head after verify)
4. Close epic + milestone on GitHub
5. PO summary includes gate pass proof

Individual gates (called by verify-sprint-close):

```powershell
powershell -File scripts/verify-sprint-db.ps1 -Sprint <N>
powershell -File scripts/verify-sprint-deploy.ps1 -Sprint <N>
powershell -File scripts/verify-sprint-board.ps1 -Sprint <N>
```

**Manifest:** `scripts/sprint_board_expectations.json` — PMO adds sprint issue list when milestone is created.

### Sprint governance CI (S36-01)

GitHub Actions workflow **`Sprint Governance CI`** (`.github/workflows/sprint-governance-ci.yml`) enforces sprint-close documentation on merges to `develop`:

| Behaviour | Detail |
|-----------|--------|
| **No-op** | Ordinary PRs without an `end_of_sprint_<N>:` commit subject exit 0 — no failure |
| **Hard fail** | `end_of_sprint_*` commit without matching `docs/governance/retros/Sprint_<N>_*_retro.md` **and** `docs/governance/health-reports/Sprint_<N>_*_health.md` |
| **Manifests** | Sprint `N` must exist in `sprint_board_expectations.json`, `sprint_db_expectations.json`, and (when `N >= enforce_from_sprint`) `sprint_deploy_expectations.json` |
| **Board** | `verify_sprint_board.py` runs only when `end_of_sprint_*` is detected; requires `PROJECT_SYNC_TOKEN` in CI |
| **Cluster** | DB + deploy gates remain **local only** via `verify-sprint-close.ps1` (no `kubectl` on GitHub-hosted runners) |

Local parity: `verify-sprint-close.ps1` calls `scripts/verify_sprint_close_ci.py --sprint <N>` as its first gate.

### Deferred-items ledger (S36-02)

At sprint close, `verify_sprint_close_ci.py` also runs `scripts/verify_sprint_deferrals.py`:

| Behaviour | Detail |
|-----------|--------|
| **Ledger** | `scripts/deferred_items_ledger.json` — every open deferral has `github_issue` + `target_milestone` |
| **Document scan** | Sprint `N` retro + health report: lines with deferral language must reference `#NNN` or a ledger id (e.g. `TD-018`) |
| **GitHub** | When `GH_TOKEN` / `PROJECT_SYNC_TOKEN` is set, linked issues must be open with the expected milestone |
| **Docs** | `docs/governance/SIP_Deferred_Items_Ledger.md` |

Local: `python scripts/verify_sprint_deferrals.py --sprint <N>`

### Health-report gate-trigger-11 checklist (S36-03)

From Sprint 36, architecture health reports must include **§9 Gate trigger #11-class checklist** (`TEMPLATE_architecture_health.md`). A **Green** summary is invalid if any checklist row is **Fail** or unset.

| Behaviour | Detail |
|-----------|--------|
| **Template** | `docs/governance/health-reports/TEMPLATE_architecture_health.md` §9 |
| **Enforcement** | `verify_health_report_gate11.py` via `verify_sprint_close_ci.py` (Sprint ≥ 36) |
| **Incident guard** | Prevents Sprint 31-style Green ratings under semantic-surface drift (TD-017 class) |

Local: `python scripts/verify_health_report_gate11.py --sprint <N>`

### Retro delivery rate vs kickoff plan (S36-07)

From Sprint 37, retros must report **Delivery rate** against the issue list frozen in the sprint **plan** at kickoff (`docs/project/Sprint_<N>_*_Plan.md` §3), not a re-scoped list at close.

| Behaviour | Detail |
|-----------|--------|
| **Template** | `docs/governance/retros/TEMPLATE_sprint_retro.md` — **Kickoff plan** link + denominator rule |
| **Enforcement** | `verify_sprint_retro_delivery.py` via `verify_sprint_close_ci.py` (Sprint ≥ 37) |
| **Scope drift** | Document dropped/added issues in §1; denominator unchanged without plan amendment |

Local: `python scripts/verify_sprint_retro_delivery.py --sprint <N>`

### Contract-sync CI (S36-05)

Backend PRs run `scripts/verify_contract_sync.py` — live `/api/v1` routes must appear in `docs/architecture/*_Contract_*.md` or `scripts/contract_sync_baseline.json` (grandfathered only).

| Behaviour | Detail |
|-----------|--------|
| **Script** | `verify_contract_sync.py` — OpenAPI vs contract markdown |
| **Baseline** | `contract_sync_baseline.json` — pre-S36-05 gaps; do not add new routes here |
| **CI** | `Backend CI` workflow step after dependency install |

Local: `PYTHONPATH=backend python scripts/verify_contract_sync.py`

**PMO manual (when GitHub CLI unavailable):** create milestone `Sprint 36 — Governance Remediation`, epic E-36, and issues S36-01…S36-07; add issue numbers to `sprint_board_expectations.json` before sprint close.

### Project board verification (details)

| Check | Failure means |
|-------|----------------|
| Issue on project board | Missing card — **blocker** |
| Workflow Status set | No status column — **blocker** |
| Status = **Done** (at sprint close) | Drift — repair before milestone close |

**On failure:** `set-board-status.ps1` or `fix-project-board.ps1`, then re-run `verify-sprint-close.ps1`.

**Manifest:** `scripts/sprint_board_expectations.json`

### Recommended MVP build sequence

Align early sprints with Implementation Guide §17:

1. Repository skeleton, core config, database base, migrations
2. `applications` — Application, ApplicationWorkspace
3. `discovery` — DiscoverySession
4. `blueprints` — Blueprint lifecycle
5. `assets` — AssetRecord registry
6. `audit_trace` — SemanticTransaction, TraceStep
7. `products`, `agents` — PublishedDataProduct, AgentDefinition
8. `governance` — lightweight Policy
9. Ports and adapters (PostgreSQL, MinIO, Fuseki, Qdrant, OpenMetadata, OpenAI)
10. Assessment MVP end-to-end flow
11. Minimal Platform Console screens

### Sprint success criteria

A sprint succeeds when all committed **Done** items meet Definition of Done and the integration branch remains deployable for demo.

---

## 10. Definition of Ready

An issue is **Ready** when all of the following are true:

- [ ] Objective and acceptance criteria are written
- [ ] Architecture references are identified (or explicitly marked N/A with Tech Lead approval)
- [ ] Affected modules are listed using canonical module names
- [ ] Dependencies on other issues are linked and resolved or scheduled
- [ ] API contract impact is noted (new/changed endpoints per `SIP_API_Boundary_v1`)
- [ ] Domain events impact is noted (if lifecycle change)
- [ ] Semantic Transaction / Trace Step expectations are stated for execution paths
- [ ] No unresolved ADR is blocking the work
- [ ] Sized for completion within one sprint
- [ ] QA test scenarios are drafted or referenced

Issues lacking architecture references for backend module work default to **Not Ready** until clarified.

---

## 11. Definition of Done

An issue is **Done** when all of the following are true:

### Code

- [ ] Implementation merged to `develop` via approved PR
- [ ] Follows module template and dependency rules (Implementation Guide §5–§6)
- [ ] No direct technology client usage outside adapters
- [ ] Lifecycle states align with `SIP_Asset_Catalog_v1` (ARR-002)
- [ ] ApplicationWorkspace changes respect nine namespace fields (ARR-001) when applicable
- [ ] Provisioning does not auto-create domain semantic assets (ARR-004)

### API and contracts

- [ ] REST endpoints under `/api/v1` per module ownership (API-002, API-003)
- [ ] Pydantic schemas for request/response; no oversized embedded graphs
- [ ] OpenAPI remains accurate for changed routes

### Events and traceability

- [ ] Domain events emitted per `SIP_Domain_Events_v1` for lifecycle changes
- [ ] Semantic Transactions and Trace Steps created for significant actions (R-013)
- [ ] Event envelope fields populated (`correlation_id`, `application_id`, etc.)

### Tests

- [ ] Unit tests for domain and service logic
- [ ] Integration tests for repositories and adapters where touched
- [ ] Trace creation tested for new execution paths
- [ ] CI pipeline green

### Quality

- [ ] Code review approved (Section 12)
- [ ] QA scenarios executed (Section 13)
- [ ] No known severity-1 or severity-2 defects open against the issue

### Documentation

- [ ] ADR created if an implementation-time architecture decision was made
- [ ] Issue updated with implementation notes if behavior deviates from spec (escalation required)

---

## 12. Code Review Process

### Review requirements

| Change type | Required reviewers |
|-------------|-------------------|
| Backend module | Tech Lead or designated backend reviewer |
| Frontend screen | Frontend reviewer |
| Architecture / ADR | Lead Architect |
| Cross-cutting (ports, shared, core) | Tech Lead + Lead Architect |
| Database migration | Backend reviewer + Tech Lead |

### Reviewer checklist

1. **Architecture compliance** — module boundaries, ports, no MCP internal usage
2. **Domain model alignment** — aggregates match `SIP_Domain_Model_v1` and ARR resolutions
3. **API ownership** — modules expose only owned assets
4. **Traceability** — Semantic Transactions for significant paths
5. **Agent rules** — agents consume Published Data Products only (D-003)
6. **Test coverage** — meaningful tests, not trivial assertions
7. **Scope** — no unrelated refactors or drive-by features
8. **Security** — no secrets, no auth bypass patterns

### AI-assisted review

Bugbot or security-review agents may supplement human review. They **do not replace** human approval for merge.

### Review outcome

- **Approve** — meets checklist
- **Request changes** — blocking issues documented
- **Comment** — non-blocking suggestions

Blocking architectural violations are resolved before merge, not deferred.

---

## 13. QA Process

### QA scope for MVP

QA validates against:

1. **MVP demo scenario** (`SIP_MVP_Scope_v0_1` — Demo Scenario)
2. **Core user journeys** relevant to the sprint (`SIP_Core_User_Journeys_v1`)
3. **Acceptance criteria** on the GitHub issue

### QA levels

| Level | Owner | When |
|-------|-------|------|
| **Developer verification** | Engineer | Before PR |
| **Peer review** | Reviewer | PR review |
| **QA execution** | QA Engineer | Post-merge to `develop` |
| **Sprint demo** | Product Owner + team | Sprint review |

### MVP end-to-end flow (regression anchor)

The following flow is the **minimum regression path** once components exist:

1. Create Assessment Application  
2. Start Discovery Session  
3. Generate and approve Blueprint  
4. Provision workspace (blank — no auto semantic assets)  
5. Register and populate knowledge assets  
6. Publish Question Bank  
7. Create Assessment Agent  
8. Ask question via Application Chat  
9. Verify Semantic Transaction and Trace Explorer output  

### Defect severity

| Severity | Definition | Action |
|----------|------------|--------|
| **S1** | MVP flow broken; data loss; security exposure | Block release; fix immediately |
| **S2** | Feature incorrect; architecture rule violated | Block issue Done |
| **S3** | Minor functional defect | Fix in sprint or backlog per PO |
| **S4** | Cosmetic | Backlog |

Architecture rule violations are treated as **S2 minimum**.

---

## 14. Testing Strategy

Aligned with `SIP_Implementation_Guide_v1` §14.

### Test pyramid

| Layer | Scope | Tools |
|-------|-------|-------|
| **Unit** | Domain models, services, pure logic | pytest; fake ports |
| **Integration** | Repositories, adapters, DB | pytest + test PostgreSQL |
| **API** | Route contracts, status codes | httpx / FastAPI TestClient |
| **End-to-end** | MVP demo flow | Approved E2E harness (frontend + backend) |

### Mandatory test rules

- Domain and service logic require unit tests
- Repository tests run against real test database infrastructure
- Adapters have integration tests with technology test instances or containers
- **Trace creation must be tested** for every new significant write or execution action
- Agents must be tested to consume products via product interfaces, not raw storage

### Test data

- Use isolated schemas/namespaces per test application workspace where integration tests touch provisioned resources
- No production data in tests
- No live LLM calls in default CI — use fakes or recorded fixtures

### CI policy

All PRs must pass CI before merge. CI includes lint, type check, unit tests, and integration tests appropriate to changed paths.

---

## 15. Documentation Rules

### What belongs where

| Content | Location |
|---------|----------|
| Platform behavior and structure | `architecture/*.docx` |
| Architecture resolutions | `docs/architecture/` |
| Implementation-time decisions | `docs/adr/` |
| Engineering process | `docs/project/` (this playbook) |
| API reference | OpenAPI from FastAPI (`/api/v1`) |
| Module README (optional) | `backend/app/modules/<module>/README.md` — operational notes only |

### Update rules

- **Do not duplicate architecture** in module READMEs. Link to source documents.
- **Do not edit** `architecture/*.docx` without Lead Architect approval and change log entry.
- Playbook updates require Tech Lead review.
- ADRs are immutable once accepted; supersede with new ADRs.

### Document naming

Follow canonical names in Implementation Guide §2 where applicable:

- `SIP_Architecture_Review_Resolution_v1.md`
- `ADR-NNN-short-title.md`

---

## 16. Architecture Governance

Organizational governance (decision authority, PR architecture gates, retro-driven process changes) is defined in `docs/governance/`. This section covers product architecture authority; governance policy covers **how it is enforced during delivery**.

### Process change rule

**Playbook and governance documents may change only after:**

1. A **Sprint Retrospective** decision recorded in `docs/governance/retros/`, or  
2. An **accepted ADR** that requires a process change.

**No spontaneous process changes during an active sprint.**

Governance v1.0 was frozen in the Governance Sprint (2026-06-25). The earliest review window for governance v1.1 is the **Sprint 2 Retrospective**.

### Authority model

| Artifact | Authority | Change control |
|----------|-----------|----------------|
| Architecture Specification | Lead Architect | Formal architecture review |
| ARR resolutions | Lead Architect | Resolution document + affected doc updates |
| Asset Catalog lifecycles | Lead Architect | Architecture change |
| Implementation Guide | Lead Architect + Tech Lead | Architecture or process review |
| ADRs | Lead Architect approval | ADR process |
| This playbook | Tech Lead + Lead Architect | PR review |

### Frozen for MVP

Per architecture readiness review, MVP architecture is **frozen** with these binding resolutions:

- **ARR-001** — nine ApplicationWorkspace namespace fields  
- **ARR-002** — Asset Catalog authoritative for lifecycles  
- **ARR-003** — plural canonical module folder names  
- **ARR-004** — blank workspace provisioning  

Accepted implementation-time ADRs supplement frozen architecture where noted (e.g. **ADR-001** — Kubernetes-first deployment runtime).

### Compliance verification

Before each sprint planning:

- Confirm no open architecture blockers
- Confirm new work maps to MVP scope or approved epic
- Confirm no module additions outside canonical list without ADR

### Drift handling

If implementation reveals ambiguity:

1. Stop and document the gap
2. Propose ADR or architecture addendum
3. Do not silently invent patterns in code

---

## 17. ADR Process

### When an ADR is required

- Module addition or boundary change
- New port or adapter type
- Lifecycle transition rules not covered by Asset Catalog
- MVP authentication approach
- SemanticTransaction orchestration pattern
- MCP implementation placement
- Any deviation from Implementation Guide or ARR resolutions

### ADR format

Create `docs/adr/ADR-NNN-title.md`:

```markdown
# ADR-NNN: Title

**Status:** Proposed | Accepted | Superseded by ADR-XXX  
**Date:** YYYY-MM-DD  
**Deciders:** Names  

## Context
What problem or ambiguity exists?

## Decision
What was decided?

## Architecture alignment
Which D-*, R-*, DM-*, API-*, ARR-* decisions apply?

## Consequences
Positive, negative, and follow-up actions.
```

### ADR lifecycle

1. **Proposed** — PR opened; architecture checkpoint scheduled  
2. **Accepted** — Lead Architect approval; merged  
3. **Superseded** — replaced by newer ADR; old ADR retained for history  

Prefix rules from Implementation Guide §2.1:

| Prefix | Use |
|--------|-----|
| D-* | Product / architecture decisions |
| R-* | Runtime architecture |
| DM-* | Domain model |
| API-* | API boundary |
| ADR-* | Implementation-time records in `docs/adr/` |

Do not renumber or rename existing D-* / R-* decisions in ADRs.

---

## 18. Prompt Engineering Guidelines

Effective AI assistance requires structured prompts. Use this template for implementation requests:

### Implementation prompt template

```
## Context
SIP backend | Issue #NNN | Sprint N

## Objective
[One sentence deliverable]

## Architecture references
- R-001, DM-002, ARR-001, API Boundary §Applications

## Affected modules
- applications (primary)
- audit_trace (SemanticTransaction on provision)

## Constraints
- Ports & Adapters only
- Asset Catalog lifecycle states
- Create SemanticTransaction on provision

## Acceptance criteria
- [ ] ...
- [ ] ...

## Files likely affected
- backend/app/modules/applications/...
```

### Prompt rules

1. **Be specific** — module names, issue IDs, decision IDs  
2. **Constrain scope** — explicit out-of-scope list  
3. **Reference architecture** — do not restate architecture in prompts; point to sources  
4. **One surface per chat** — backend OR frontend  
5. **Ask mode for review** — use read-only analysis before large changes  
6. **Request plan first** — for multi-file features, ask for implementation plan before code  
7. **No silent architecture** — if the prompt requires a new concept, stop and open an ADR  

### Anti-patterns

- "Build the whole platform"  
- "Just make it work" without module context  
- Mixing frontend and backend in backend-scoped chat  
- Prompts that ask AI to change architecture documents during feature work  

---

## 19. Release Process

### Release types (MVP phase)

| Type | Branch | Purpose |
|------|--------|---------|
| **Development** | `develop` | Continuous integration demo |
| **MVP milestone** | `main` | Stakeholder demo / milestone tag |
| **Hotfix** | `main` + cherry-pick | Critical S1 fix |

### MVP milestone release checklist

- [ ] MVP demo flow passes QA end-to-end  
- [ ] CI green on `main`  
- [ ] No open S1/S2 defects for milestone scope  
- [ ] OpenAPI reflects shipped API  
- [ ] Release notes document known limitations vs. MVP Scope out-of-scope list  
- [ ] Infrastructure deploys successfully via Kubernetes/Kustomize (`infra/kubernetes/`, ADR-001)  
- [ ] Lead Architect sign-off — no open architecture violations  

### Versioning

- **MVP:** `0.x.y` semantic versioning  
- Tag format: `v0.1.0-mvp-milestone-1`  
- Breaking API changes require version bump and API Boundary update approval  

### Out of scope for MVP releases

Do not block MVP milestone for: multi-tenant SaaS, HA, multi-region, enterprise IAM, Kafka, marketplace, advanced monitoring — per `SIP_MVP_Scope_v0_1`.

---

## 20. Long-term Development Principles

These principles guide SIP beyond MVP while preserving architectural intent.

### Preserve module extraction option

The modular monolith is deliberate (R-001). Maintain module boundaries, event envelopes, and port interfaces so future service extraction does not require redesign.

### Keep capabilities internal

Applications do not select platform capabilities (D-016, D-020). Engineering avoids exposing capability toggles in application APIs.

### Maintain technology replaceability

New technologies ship as adapters, not forks of business logic. Adapter addition requires ADR if it introduces a new port contract.

### Grow governance deliberately

v1 uses lightweight Policy intent (DM-010). Do not build a complex rule engine until architecture explicitly expands it.

### Event-ready, broker-later

Domain events use in-process dispatch and PostgreSQL outbox in v1. Design handlers as if external streaming may arrive later (Domain Events v1).

### Console follows application-centric UX

Platform Console organization follows D-036, D-037 — Applications first, not technology-first navigation.

### Trace everything significant

As features accrue, resist shortcuts that skip Semantic Transactions. Explainability is a product differentiator, not optional logging.

### Document decisions, not meetings

Prefer ADRs and architecture supplements over undocumented team consensus.

### Reduce playbook entropy

Update this playbook when process changes. Do not maintain parallel informal process documents.

---

## Appendix A — Quick Reference

### Canonical documents for implementers

1. `SIP_Implementation_Guide_v1`  
2. `SIP_MVP_Scope_v0_1`  
3. `SIP_Runtime_Architecture_Decisions_v1`  
4. `SIP_Domain_Model_v1`  
5. `SIP_Domain_Events_v1`  
6. `SIP_API_Boundary_v1`  
7. `docs/architecture/SIP_Architecture_Review_Resolution_v1.md`  
8. `docs/adr/ADR-001-cloud-native-deployment-strategy.md`  
9. `docs/governance/` — decision authority and architecture governance (v1.0)  
10. **This playbook**

### Decision prefix quick reference

| Prefix | Document |
|--------|----------|
| D-* | `SIP_Architecture_Decision_Log_v1` |
| R-* | `SIP_Runtime_Architecture_Decisions_v1` |
| DM-* | `SIP_Domain_Model_v1` |
| API-* | `SIP_API_Boundary_v1` |
| ARR-* | `docs/architecture/SIP_Architecture_Review_Resolution_v1.md` |
| ADR-* | `docs/adr/` (e.g. ADR-001 deployment runtime) |

### Canonical backend modules (ARR-003)

`applications` · `discovery` · `blueprints` · `assets` · `ontology` · `knowledge_graph` · `products` · `agents` · `agent_runtime` · `governance` · `adapters` · `audit_trace` · `platform_admin`

---

## Appendix B — Document history

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-25 | SIP Engineering | Initial authoritative playbook |
| 1.1 | 2026-06-25 | SIP Engineering | Governance Sprint v1.0 references; process change rule; Architecture Health Check |

---

*This document defines how SIP is built. For what SIP is and how it behaves, consult the architecture document set in `architecture/`.*

# SIP GitHub Workflow

**Product:** Semantic Intelligence Platform (SIP)  
**Version:** 1.1  
**Status:** Authoritative — Project Management Supplement  
**Audience:** Product Owner, Tech Lead, Engineers, QA, Lead Architect  
**Scope:** Defines **how SIP work is tracked and delivered in GitHub**. It does not define platform behavior.

---

## Document Authority

This document is a project management supplement. When GitHub workflow questions arise, consult documents in this order:

1. `architecture/` — frozen MVP architecture (`.docx` specifications)
2. `docs/architecture/SIP_Architecture_Review_Resolution_v1.md` — ARR-001–ARR-004 (binding)
3. `docs/adr/ADR-001-cloud-native-deployment-strategy.md` — Kubernetes-first runtime (Accepted)
4. `SIP_Implementation_Guide_v1` — module template, build order (§17), testing (§14)
5. `SIP_MVP_Scope_v0_1` — MVP in/out scope and demo scenario
6. `docs/project/SIP_DEVELOPMENT_PLAYBOOK.md` — engineering process and quality gates
7. **This document** — GitHub project structure, issue standards, and delivery workflow

If a GitHub practice conflicts with architecture, **architecture wins**. Escalate through the architecture escalation workflow (Section 14).

**Binding constraints for all issues:**

- Canonical backend modules use **plural folder names** per ARR-003.
- Architecture changes do **not** belong in normal implementation issues — use ADR or architecture addendum issues.
- **GitHub issues are the primary unit of implementation work.**
- Every implementation issue must include **architecture references** and **acceptance criteria**.

---

## 1. GitHub Project Board Structure

SIP uses a **single GitHub Project** (Projects v2) linked to the SIP monorepo.

### Project name

`SIP MVP Delivery`

### Views

| View | Purpose | Filter / grouping |
|------|---------|-------------------|
| **Board** | Daily execution | Status field → columns (Section 2) |
| **Backlog** | Prioritization | Status = Backlog or Ready; sort by Priority |
| **Sprint** | Active sprint work | Milestone = current sprint |
| **Architecture** | ADR and escalation items | Label `type:adr` or `architecture` |
| **QA** | Post-merge validation | Status = QA |
| **Roadmap** | Milestone planning | Group by Milestone |

### Project fields (custom)

Configure these fields on the GitHub Project in addition to native issue fields:

| Field | Type | Values / use |
|-------|------|----------------|
| **Status** | Single select | Maps to board columns (Section 2) |
| **Priority** | Single select | `P0` · `P1` · `P2` · `P3` |
| **Sprint** | Iteration or Milestone | Links to sprint milestone |
| **Surface** | Single select | `backend` · `frontend` · `infra` · `docs` · `cross-cutting` |
| **Module** | Single select (multi allowed via labels) | Canonical module names (ARR-003) or `core` · `shared` · `n/a` |
| **Architecture refs** | Text | e.g. `R-001, DM-002, ARR-001` |
| **MVP scope ref** | Text | Reference to `SIP_MVP_Scope_v0_1` section or demo step |
| **Estimate** | Number | Story points or days (team convention) |

Native GitHub issue fields used on every implementation issue: **Title**, **Body** (required sections in Section 8), **Labels**, **Milestone**, **Assignees**, **Parent issue** (for epic hierarchy).

### Epic tracking

- Parent issues of type Epic group child Feature/Task issues.
- GitHub Project **Roadmap** view groups by parent epic where enabled.

---

## 2. Required Columns

The Board view uses the **Status** field with exactly these columns, in order:

| Column | Entry criteria | Exit criteria |
|--------|----------------|---------------|
| **Backlog** | Issue created; not yet Ready | Definition of Ready met (Section 9) |
| **Ready** | DoR checklist complete; PO or Tech Lead acknowledged | Sprint planning commitment or immediate pull |
| **In Progress** | Assignee active; branch linked in issue | PR opened |
| **In Review** | PR open targeting `develop` (or `main` for hotfix) | PR approved and CI green |
| **QA** | PR merged to `develop` | QA scenarios pass; no open S1/S2 against issue |
| **Done** | Definition of Done met (Section 10) | — |

**Rules:**

- Issues do not skip **In Review** when code is involved.
- Issues without code (pure docs/ADR/project setup) may move **In Progress → Done** after PR merge and reviewer sign-off, unless QA scenarios apply.
- **Blocked** is not a column — use label `status:blocked` and a comment explaining the blocker.
- WIP limits (recommended): In Progress ≤ 2 per engineer; In Review ≤ 3 per reviewer.

---

## 3. Issue Types

Use GitHub issue types (or equivalent label prefix `type:`) consistently:

| Type | Label | Use | Typical children |
|------|-------|-----|------------------|
| **Epic** | `type:epic` | Multi-sprint capability aligned to MVP journey or module | Features, Tasks |
| **Feature** | `type:feature` | User-visible or API-deliverable unit of work | Tasks |
| **Task** | `type:task` | Technical subtask completable in part of a sprint | — |
| **Bug** | `type:bug` | Defect against acceptance criteria or architecture rule | — |
| **ADR** | `type:adr` | Architecture decision record work in `docs/adr/` | — |
| **Spike** | `type:spike` | Time-boxed investigation (max 2 days); must produce ADR, issue, or addendum outcome | — |
| **Chore** | `type:chore` | Tooling, CI, repo hygiene without feature behavior | — |

### Type selection rules

| Situation | Type |
|-----------|------|
| Spans multiple sprints / modules | Epic |
| Delivers API endpoint, screen, or workflow step | Feature |
| Migration, test harness, refactor within one feature | Task |
| Production or QA-found defect | Bug |
| Module addition, port change, lifecycle rule, auth approach | ADR |
| Unknown design before implementation | Spike |
| Label setup, dependabot, formatter config | Chore |

**Architecture changes never use Feature or Task alone** — open `type:adr` or `type:spike` first; implementation issues reference the accepted ADR.

---

## 4. Issue Labels

Labels are grouped by purpose. Apply **at least one label from each required group** on implementation issues.

### Required label groups

| Group | Labels | Required on |
|-------|--------|-------------|
| **Type** | `type:epic`, `type:feature`, `type:task`, `type:bug`, `type:adr`, `type:spike`, `type:chore` | All issues |
| **Surface** | `surface:backend`, `surface:frontend`, `surface:infra`, `surface:docs`, `surface:cross-cutting` | All issues |
| **Module** | `module:<name>` — see Section 18 | Backend/frontend implementation |
| **Priority** | `priority:p0` … `priority:p3` | Backlog and Ready items |

### Optional workflow labels

| Label | Use |
|-------|-----|
| `status:blocked` | External dependency or unresolved ADR |
| `status:needs-architecture` | Ambiguity requires Lead Architect input |
| `status:needs-qa` | Ready for QA pickup |
| `qa:regression` | Touches MVP demo flow — full regression required |
| `good-first-issue` | Well-scoped starter task |

### Architecture and scope labels

| Label | Use |
|-------|-----|
| `architecture` | Relates to architecture documents or ARR resolutions |
| `mvp-scope` | Maps to `SIP_MVP_Scope_v0_1` |
| `out-of-mvp` | Explicitly deferred; requires PO approval to implement |
| `arr-001` … `arr-004` | Issue materially implements an ARR resolution |

---

## 5. Milestone Structure

Milestones represent **time-boxed delivery containers** and **release targets**.

### Milestone categories

| Category | Naming pattern | Duration | Branch target |
|----------|----------------|----------|---------------|
| **Sprint** | `Sprint N — <theme>` | 2 weeks (default) | `develop` |
| **MVP release** | `MVP v0.x — <name>` | Multi-sprint | `main` tag |
| **Architecture** | `Architecture — <topic>` | As needed | `develop` (docs only) |

### Sprint milestones

- One milestone per sprint, created before sprint planning.
- Only **committed** issues carry the sprint milestone at planning time.
- Stretch goals stay in Backlog without sprint milestone.

### MVP release milestones

| Milestone | Target outcome |
|-----------|----------------|
| `MVP v0.1 — Foundation` | Repo, CI, skeleton, `applications` module |
| `MVP v0.2 — Discovery & Blueprint` | Discovery and Blueprint lifecycles |
| `MVP v0.3 — Workspace & Assets` | Provisioning, assets, audit trace |
| `MVP v0.4 — Products & Agents` | Products, agents, governance baseline |
| `MVP v0.5 — Adapters & Integration` | Ports/adapters for MVP technologies |
| `MVP v0.6 — Assessment E2E` | Full Assessment demo flow |
| `MVP v1.0 — Console & Release` | Minimal Platform Console + stakeholder demo |

Release milestones span multiple sprints; sprint milestones nest under them via issue linking and project Roadmap view.

### Milestone completion criteria

A milestone is **closed** when:

- All committed issues are **Done**
- No open S1/S2 defects against milestone scope
- Sprint review or release checklist signed per `SIP_DEVELOPMENT_PLAYBOOK.md` Sections 13 and 19

---

## 6. Sprint Naming Convention

### Format

```
Sprint <N> — <short theme>
```

### Rules

- **N** is a monotonic integer starting at **0** for foundation work.
- **Theme** is 2–5 words describing the primary module or outcome (not a feature list).
- Themes align with `SIP_Implementation_Guide_v1` §17 build order unless reprioritized by Product Owner with Lead Architect sign-off.

### Examples

| Sprint | Name |
|--------|------|
| Sprint 0 | `Sprint 0 — Project Foundation` |
| Sprint 1 | `Sprint 1 — Applications Module` |
| Sprint 2 | `Sprint 2 — Discovery Module` |
| Sprint 3 | `Sprint 3 — Blueprint Lifecycle` |
| Sprint 4 | `Sprint 4 — Assets & Audit Trace` |

### GitHub mapping

- Create a **Milestone** titled exactly as the sprint name.
- Set milestone **due date** to sprint end (planning day + 2 weeks).
- Reference sprint in PR titles: `[#issue] Short description` (issue carries sprint milestone).

---

## 7. Epic Structure

Epics group issues that deliver a coherent MVP capability. One epic should not span unrelated modules without a journey mapping.

### Epic issue template (summary)

Epics use `type:epic` and include:

- **Objective** — capability delivered across sprints
- **MVP scope reference** — section in `SIP_MVP_Scope_v0_1` or user journey in `SIP_Core_User_Journeys_v1`
- **Architecture references** — primary D-*, R-*, DM-*, API-*, ARR-*
- **Modules involved** — canonical list (ARR-003)
- **Child issues** — linked Features/Tasks (GitHub sub-issues or task list)
- **Success criteria** — demonstrable outcome for sprint review
- **Out of scope** — explicit exclusions

### MVP epic catalog (initial)

| Epic ID (suggested) | Title | Primary modules | MVP alignment |
|-------------------|-------|-----------------|---------------|
| E-01 | Platform foundation & delivery | `core`, `infra`, `docs` | Implementation Guide §17 step 1; ADR-001 Kubernetes foundation |
| E-02 | Application & workspace management | `applications` | Journey 1; ARR-001, ARR-004 |
| E-03 | Discovery workflow | `discovery` | R-007; Discovery 10 phases |
| E-04 | Blueprint lifecycle | `blueprints` | ARR-002 Blueprint states |
| E-05 | Asset registry | `assets` | Asset Catalog; ARR-002 |
| E-06 | Semantic trace & audit | `audit_trace` | R-013, R-014, DM-006 |
| E-07 | Data products | `products` | D-003 product consumption |
| E-08 | Agent definitions & runtime | `agents`, `agent_runtime` | R-011, R-012 |
| E-09 | Ontology & knowledge graph | `ontology`, `knowledge_graph` | MVP knowledge population |
| E-10 | Governance (lightweight) | `governance` | DM-010 Policy |
| E-11 | Technology adapters | `adapters` | R-018 Ports & Adapters |
| E-12 | Assessment MVP E2E | cross-cutting | `SIP_MVP_Scope_v0_1` demo |
| E-13 | Platform Console (minimal) | `surface:frontend` | Screen map MVP subset |

Epics **E-01** through **E-04** are prioritized for early sprints per Implementation Guide §17.

### Epic rules

- Epics do not merge code — child issues do.
- An epic stays **open** until all committed children for the MVP slice are **Done**.
- New epics require PO approval and must map to MVP scope or approved expansion.

---

## 8. Required Issue Fields

Every **implementation** issue (Feature, Task, Bug) must contain these sections in the body. Issues missing required sections default to **Not Ready**.

```markdown
## Objective
[One paragraph: what is delivered]

## Architecture references
- [D-*, R-*, DM-*, API-*, ARR-* — at least one for backend module work]

## MVP scope reference
- [Section or demo step from SIP_MVP_Scope_v0_1, or "N/A — infrastructure" with Tech Lead approval]

## Affected modules
- [Canonical module names per ARR-003, or surface: infra/docs]

## API contract impact
- [New/changed endpoints per SIP_API_Boundary_v1, or "None"]

## Domain events impact
- [Events emitted/consumed per SIP_Domain_Events_v1, or "None"]

## Semantic Transaction / Trace Step expectations
- [What significant actions create traces, or "N/A" with justification]

## Dependencies
- [Linked issues #NNN, or "None"]

## Acceptance criteria
- [ ] [Testable statement]
- [ ] [Testable statement]

## Out of scope
- [Explicit exclusions]

## QA scenarios
- [Test steps or link to scenario doc]
```

### ADR issues (additional sections)

```markdown
## Ambiguity
[What is unclear in architecture]

## Options considered
[Alternatives]

## Proposed decision
[Draft decision text]

## Affected documents
[List .docx or supplement paths]
```

### Automation note

When `.github/ISSUE_TEMPLATE/` is created (Sprint 0), templates must embed these sections so authors cannot omit them.

---

## 9. Definition of Ready Checklist

An issue moves from **Backlog** to **Ready** when **all** items are satisfied:

- [ ] **Objective** and **acceptance criteria** are written and testable
- [ ] **Architecture references** identified (or `N/A` with Tech Lead approval for pure infra/chore)
- [ ] **Affected modules** use canonical names (ARR-003)
- [ ] **MVP scope reference** documented or explicitly approved as out-of-MVP
- [ ] **Dependencies** linked; blockers resolved or scheduled
- [ ] **API contract impact** noted
- [ ] **Domain events impact** noted (if lifecycle or state change)
- [ ] **Semantic Transaction / Trace Step expectations** stated for execution paths
- [ ] **No unresolved ADR** blocks the work
- [ ] **Sized** for completion within one sprint
- [ ] **QA scenarios** drafted or referenced
- [ ] **Surface** label matches intended Cursor chat (backend vs. frontend vs. infra)
- [ ] **Priority** label assigned
- [ ] For backend module work: `SIP_Implementation_Guide_v1` §5 module template applicability confirmed

**Gate:** Tech Lead or PO moves issue to **Ready** at backlog refinement or sprint planning.

---

## 10. Definition of Done Checklist

An issue moves to **Done** when **all** items are satisfied.

### Delivery

- [ ] Implementation merged to `develop` via approved PR (or docs-only equivalent)
- [ ] Issue body updated with implementation notes if behavior differs from spec (requires escalation — Section 14)
- [ ] Parent epic checklist updated if applicable

### Architecture compliance

- [ ] Follows module template and dependency rules (`SIP_Implementation_Guide_v1` §5–§6)
- [ ] No direct technology client usage outside `adapters`
- [ ] Lifecycle states align with `SIP_Asset_Catalog_v1` (ARR-002)
- [ ] ApplicationWorkspace changes include nine namespace fields when applicable (ARR-001)
- [ ] Provisioning does not auto-create domain semantic assets (ARR-004)
- [ ] REST under `/api/v1`; module owns its API surface (API-002, API-003)
- [ ] No internal MCP usage (API-001)

### Traceability

- [ ] Domain events per `SIP_Domain_Events_v1` for lifecycle changes
- [ ] Semantic Transactions and Trace Steps for significant actions (R-013)
- [ ] Trace creation covered by tests for new execution paths

### Quality

- [ ] Unit tests for domain and service logic
- [ ] Integration tests for repositories/adapters where touched
- [ ] CI pipeline green
- [ ] Code review approved (Section 12)
- [ ] QA scenarios executed (Section 13)
- [ ] No open S1 or S2 defects against the issue

### Documentation

- [ ] ADR merged if an implementation-time architecture decision was made
- [ ] OpenAPI accurate for changed routes

**Gate:** QA Engineer or PO confirms **Done** after QA column validation.

---

## 11. Pull Request Workflow

### Branch creation

1. Branch from `develop` (from `main` only for approved hotfixes).
2. Name branch per playbook:

```
feature/<issue-id>-<short-description>
bugfix/<issue-id>-<short-description>
adr/<short-description>
docs/<short-description>
chore/<short-description>
```

### PR conventions

| Element | Convention |
|---------|------------|
| **Title** | `[#<issue>] <imperative short description>` |
| **Target branch** | `develop` (default) |
| **Linked issues** | `Closes #<issue>` or `Refs #<issue>` |
| **Draft PR** | Encouraged for early feedback on features > 3 days |

New PRs are pre-filled from `.github/pull_request_template.md`; the **`Closes #NNN`** line is mandatory for issue auto-close and board hygiene (TD-020).

### Required PR body sections

```markdown
## Summary
[What changed and why]

## Architecture references
- [Same IDs as issue]

## Acceptance criteria
- [ ] [Copy from issue — check off in PR]

## Test plan
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual verification steps

## Module(s)
- [Canonical module list]

## Trace / events
- [SemanticTransaction and events created — or N/A]

## Screenshots / API samples
[If UI or API contract change]
```

### PR lifecycle

```
Branch created → Draft PR (optional) → CI runs → Ready for review
  → In Review → Approved + CI green → Merge to develop → Issue → QA
```

### Merge policy

- **Squash merge** preferred for feature branches (clean history, one commit per issue optional).
- Delete branch after merge.
- No merge with failing CI or unresolved blocking review comments.
- No merge that introduces secrets or `.env` files.

### Cross-surface PRs

Avoid single PRs spanning backend and frontend. When unavoidable:

1. API contract agreed and documented in issue
2. Backend merges first unless purely additive contract
3. Frontend PR references stabilized backend on `develop`
4. Both tracked under one issue with checklist items per surface

---

## 12. Review Workflow

### Reviewer assignment

| Change type | Required reviewers |
|-------------|-------------------|
| Backend module | Tech Lead or designated backend reviewer |
| Frontend screen | Frontend reviewer |
| ADR / architecture docs | Lead Architect |
| Cross-cutting (`core`, `shared`, ports) | Tech Lead + Lead Architect |
| Database migration | Backend reviewer + Tech Lead |
| Infra / CI | Tech Lead |
| Project docs only | Tech Lead or PO |

### Review stages

1. **Automated** — CI (lint, type check, unit/integration tests per changed paths)
2. **AI-assisted** (optional) — Bugbot / security-review on PR; does not replace human approval
3. **Human** — architecture compliance, scope, tests, traceability

### Reviewer checklist

1. Architecture compliance — module boundaries, ports, no MCP internal usage
2. Domain model alignment — aggregates match `SIP_Domain_Model_v1` and ARR resolutions
3. API ownership — modules expose only owned assets
4. Traceability — Semantic Transactions on significant paths
5. Agent rules — agents consume Published Data Products only (D-003)
6. Test coverage — meaningful tests; trace creation tested
7. Scope — no unrelated refactors
8. Security — no secrets, no auth bypass

### Outcomes

| Outcome | Action |
|---------|--------|
| **Approve** | Merge when CI green |
| **Request changes** | Blocking; issue stays In Review |
| **Comment** | Non-blocking suggestions |

Blocking architectural violations are resolved **before** merge, not deferred.

---

## 13. QA Workflow

### When QA starts

QA begins when the issue is in the **QA** column — i.e., after merge to `develop`.

### QA inputs

1. Issue **acceptance criteria**
2. Issue **QA scenarios**
3. **MVP demo scenario** (`SIP_MVP_Scope_v0_1`)
4. **Core user journeys** relevant to the sprint (`SIP_Core_User_Journeys_v1`)

### QA levels

| Level | Owner | When |
|-------|-------|------|
| Developer verification | Engineer | Before PR |
| Peer review | Reviewer | PR review |
| QA execution | QA Engineer | Post-merge (`develop`) |
| Sprint demo | PO + team | Sprint review |

### Regression anchor

Issues labeled `qa:regression` require the full MVP flow once components exist:

1. Create Assessment Application
2. Start Discovery Session
3. Generate and approve Blueprint
4. Provision workspace (blank — no auto semantic assets)
5. Register and populate knowledge assets
6. Publish Question Bank
7. Create Assessment Agent
8. Ask question via Application Chat
9. Verify Semantic Transaction and Trace Explorer output

### Defect handling

| Severity | Definition | GitHub action |
|----------|------------|---------------|
| **S1** | MVP flow broken; data loss; security | `type:bug` + `priority:p0`; block release |
| **S2** | Feature incorrect; architecture rule violated | `type:bug` + `priority:p1`; block issue Done |
| **S3** | Minor functional defect | `priority:p2`; fix in sprint or backlog |
| **S4** | Cosmetic | `priority:p3`; backlog |

Architecture rule violations are **S2 minimum**. Link defect issues to the originating issue and epic.

### QA completion

QA passes when:

- All acceptance criteria verified
- QA scenarios pass
- No open S1/S2 for the issue
- QA Engineer comments on issue with pass/fail and evidence
- Issue moved to **Done**

---

## 14. Architecture Escalation Workflow

Architecture is **frozen for MVP** with binding resolutions ARR-001–ARR-004. Implementation must not silently redefine architecture.

### When to escalate

Escalate (stop implementation) when:

- Module boundary is unclear or requires a new top-level module
- Lifecycle transition is undefined in Asset Catalog
- New port or adapter type is needed
- MVP authentication approach is undefined for the work
- SemanticTransaction orchestration pattern is unclear
- MCP exposure placement is required
- Any conflict between documents is discovered

**Do not** resolve ambiguity in a Feature or Task PR. Open an architecture track issue.

### Escalation issue types

| Step | Issue type | Owner | Output |
|------|------------|-------|--------|
| 1. Document gap | `type:spike` or `type:adr` | Lead Architect | Decision proposal |
| 2. Record decision | `type:adr` → `docs/adr/ADR-NNN-*.md` | Lead Architect | Accepted ADR |
| 3. Update supplements | `type:task` + `architecture` label | Lead Architect / Docs | `docs/architecture/` or approved `.docx` update |
| 4. Resume implementation | Original Feature/Task | Engineer | PR references ADR |

### ADR required when

- Module addition or boundary change
- New port or adapter type
- Lifecycle transition rules not in Asset Catalog
- MVP authentication approach
- SemanticTransaction orchestration pattern
- MCP implementation placement
- Deviation from Implementation Guide or ARR resolutions

### Escalation flow

```
Implementation blocked → label status:needs-architecture
  → Spike (time-boxed) OR ADR issue opened
  → Lead Architect review (Architecture chat / PR)
  → ADR Accepted + docs updated
  → Blocked implementation issue updated with ADR reference
  → Returns to Ready → In Progress
```

### Sprint 1 clarification backlog (from Architecture Readiness Review)

These items should be resolved as **ADR or architecture addendum**, not as silent code decisions:

| Topic | Suggested track |
|-------|-----------------|
| Ontology / KnowledgeGraph DM aggregates | ADR + DM addendum |
| Lifecycle transition matrix (Blueprint, Application, Product) | Architecture addendum |
| MVP authentication stub | ADR |
| Data Layer asset ownership (Connector/DataSource) | ADR or explicit MVP deferral |
| SemanticTransaction orchestration | ADR |
| MCP implementation placement | ADR |

---

## 15. Sprint 0 Milestone Definition

**Milestone:** `Sprint 0 — Project Foundation`  
**Epic:** E-01 Platform foundation & delivery  
**Goal:** Establish monorepo skeleton, **Kubernetes-first** delivery toolchain, GitHub governance, and CI baseline so Sprint 1 module work begins on a stable foundation.

Per **ADR-001** (Accepted), **Kubernetes** is the primary development and deployment runtime. Docker Compose may exist only as an optional, non-authoritative developer convenience.

### In scope

- GitHub Project, labels, milestones, issue/PR templates
- Branch protection on `main` and `develop`
- Monorepo directory layout per Implementation Guide
- Backend FastAPI skeleton (`backend/app/core`, empty `modules/` structure)
- Alembic + PostgreSQL baseline migration (empty or infra-only tables)
- **Kubernetes development foundation** under `infra/kubernetes/` (Kustomize `base/` + `overlays/dev/`)
- **`sip-dev` namespace**, backend and PostgreSQL deployable to local cluster (Docker Desktop Kubernetes or equivalent)
- CI pipeline: lint, type check, pytest (smoke tests), Kustomize validation
- Infrastructure README and Local Development Guide
- Cursor rules referenced from playbook
- No business module implementation beyond scaffolding

### Out of scope

- Domain aggregates (Application, Blueprint, etc.)
- Adapter implementations beyond PostgreSQL baseline
- Platform Console screens
- MVP demo flow
- Full platform stack (MinIO, Fuseki, Qdrant, OpenMetadata) — placeholder manifests only
- Architecture document edits (unless blocking — escalate via Section 14)

### Success criteria

- [ ] All Sprint 0 issues **Done**
- [ ] **Kubernetes cluster running** (local dev cluster)
- [ ] **`sip-dev` namespace** created and documented
- [ ] **Backend deployable** to cluster (Deployment, Service, health/readiness/liveness probes)
- [ ] **PostgreSQL deployable** to cluster (StatefulSet or equivalent with PVC)
- [ ] **Health endpoint reachable** (e.g. `api.sip.local/api/v1/health` via Ingress or documented port-forward)
- [ ] **CI green** on `develop` (including Kustomize validation)
- [ ] GitHub Project board operational with required columns
- [ ] Engineers can open a Ready issue and follow workflow end-to-end

### Sprint 0 roadmap

| Order | ID | Issue | Priority | Depends on | Track |
|-------|-----|-------|----------|------------|-------|
| 1 | S0-01 | Configure GitHub Project and labels | P0 | — | Governance |
| 2 | S0-02 | Branch protection and merge policy | P0 | — | Governance |
| 3 | S0-03 | Issue and PR templates | P0 | S0-01 | Governance |
| 4 | S0-04 | Monorepo directory skeleton | P0 | — | Scaffold |
| 5 | S0-05 | FastAPI application bootstrap | P0 | S0-04 | Backend |
| 6 | S0-10 | Kubernetes namespace and Kustomize foundation | P0 | S0-04 | Infra |
| 7 | S0-07 | Kubernetes Development Foundation | P0 | S0-05, S0-10 | Infra |
| 8 | S0-06 | PostgreSQL and Alembic baseline | P1 | S0-07 | Backend + Infra |
| 9 | S0-11 | Kustomize validation in CI | P0 | S0-10 | CI |
| 10 | S0-08 | CI pipeline baseline | P0 | S0-04 | CI |
| 11 | S0-12 | Infrastructure README and Local Development Guide | P1 | S0-07, S0-10 | Docs |
| 12 | S0-13 | Optional PostgreSQL Compose fallback (non-authoritative) | P3 | S0-07 | Infra (optional) |
| 13 | S0-09 | Epic E-01 and Sprint 0 tracking | P2 | S0-01–S0-13 | Governance |

### Architecture references

- R-001 (modular monolith)
- R-003 (monorepo)
- ARR-003 (canonical module folder names — scaffold only)
- **ADR-001** (Kubernetes-first runtime, `sip-dev` namespace, Kustomize overlays)
- `SIP_Implementation_Guide_v1` §17 step 1

---

## 16. Sprint 1 Milestone Definition

**Milestone:** `Sprint 1 — Applications Module`  
**Epic:** E-02 Application & workspace management  
**Goal:** Deliver `applications` module with Application and ApplicationWorkspace per domain model, blank provisioning contract, and architecture clarifications required before parallel module development.

### In scope

- `applications` module full template (api, domain, services, repositories, ports)
- Application aggregate and CRUD API (`/api/v1/applications`)
- ApplicationWorkspace with **nine namespace fields** (ARR-001)
- Blank workspace provisioning behavior (ARR-004) — metadata/namespaces only
- Lifecycle states per Asset Catalog for Application (ARR-002)
- SemanticTransaction on significant writes (R-013) — coordinate with `audit_trace` stub or minimal integration
- Unit and API tests
- Sprint 1 architecture ADRs (auth stub, trace orchestration, Ontology/KG DM minimum) as **parallel docs track**

### Out of scope

- Discovery, Blueprint, full audit_trace UI
- Ontology/KG population workflows
- Full adapter implementations (may stub ports)
- Platform Console (API-only acceptable)
- Connector/DataSource management

### Success criteria

- [ ] Create Application via API
- [ ] Provision blank ApplicationWorkspace with all nine namespace fields persisted
- [ ] No domain semantic assets created at provision time
- [ ] Application lifecycle transitions follow Asset Catalog labels
- [ ] Significant actions emit domain events and create SemanticTransaction records (per ADR if orchestration ADR accepted)
- [ ] Sprint 1 clarification ADRs **Accepted** or explicitly deferred with PO sign-off

### Architecture references

- DM-001, DM-002 (Application, ApplicationWorkspace)
- ARR-001, ARR-002, ARR-004
- R-013, R-014
- API Boundary — Applications module
- `SIP_MVP_Scope_v0_1` — Application creation step

### Dependencies

- Sprint 0 **Done** (Kubernetes `sip-dev` environment operational per ADR-001)
- Recommended: ADR for MVP auth stub before exposing APIs beyond local dev

---

## 17. Initial MVP Milestone Roadmap

Roadmap follows `SIP_Implementation_Guide_v1` §17 and `SIP_DEVELOPMENT_PLAYBOOK.md` Section 9.

| Phase | Sprints (indicative) | Milestone | Primary modules / outcomes |
|-------|-------------------|-----------|----------------------------|
| **Foundation** | Sprint 0 | `MVP v0.1 — Foundation` | Repo, CI, K8s dev foundation, GitHub workflow |
| **Applications** | Sprint 1 | (part of v0.1) | `applications` — App + Workspace |
| **Discovery** | Sprint 2 | `MVP v0.2 — Discovery & Blueprint` | `discovery` — DiscoverySession |
| **Blueprint** | Sprint 3 | (part of v0.2) | `blueprints` — lifecycle |
| **Assets & trace** | Sprint 4 | `MVP v0.3 — Workspace & Assets` | `assets`, `audit_trace` |
| **Products & agents** | Sprint 5–6 | `MVP v0.4 — Products & Agents` | `products`, `agents`, `governance` |
| **Knowledge** | Sprint 6–7 | (part of v0.4–v0.5) | `ontology`, `knowledge_graph` |
| **Adapters** | Sprint 7–8 | `MVP v0.5 — Adapters & Integration` | `adapters` — PostgreSQL, MinIO, Fuseki, Qdrant, OpenMetadata, OpenAI |
| **Agent runtime** | Sprint 8 | (part of v0.5) | `agent_runtime` |
| **E2E Assessment** | Sprint 9–10 | `MVP v0.6 — Assessment E2E` | Cross-module demo flow |
| **Console & release** | Sprint 11–12 | `MVP v1.0 — Console & Release` | Minimal Platform Console; tag `main` |

### Roadmap rules

- Sprints are **indicative** — PO adjusts with architect sign-off.
- No sprint delivers isolated POCs — each must integrate with the lifecycle.
- `agent_runtime` follows `agents` and `products` (R-011, R-012).
- Adapters may begin in parallel once port interfaces stabilize (ADR if port contract changes).
- MVP v1.0 release requires playbook Section 19 checklist.

---

## 18. Recommended GitHub Labels

Create these labels in the repository (colors are suggestions).

### Type (required)

| Label | Color | Description |
|-------|-------|-------------|
| `type:epic` | `#5319E7` | Multi-sprint capability |
| `type:feature` | `#1D76DB` | Deliverable feature |
| `type:task` | `#0E8A16` | Technical subtask |
| `type:bug` | `#D73A4A` | Defect |
| `type:adr` | `#FBCA04` | Architecture decision |
| `type:spike` | `#F9D0C4` | Time-boxed investigation |
| `type:chore` | `#C5DEF5` | Tooling / hygiene |

### Surface (required)

| Label | Color |
|-------|-------|
| `surface:backend` | `#006B75` |
| `surface:frontend` | `#61DAFB` |
| `surface:infra` | `#BFD4F2` |
| `surface:docs` | `#0075CA` |
| `surface:cross-cutting` | `#E99695` |

### Module (ARR-003)

`module:applications` · `module:discovery` · `module:blueprints` · `module:assets` · `module:ontology` · `module:knowledge_graph` · `module:products` · `module:agents` · `module:agent_runtime` · `module:governance` · `module:adapters` · `module:audit_trace` · `module:platform_admin` · `module:core` · `module:shared`

### Priority

`priority:p0` (red) · `priority:p1` (orange) · `priority:p2` (yellow) · `priority:p3` (gray)

### Workflow / scope

`status:blocked` · `status:needs-architecture` · `status:needs-qa` · `qa:regression` · `architecture` · `mvp-scope` · `out-of-mvp` · `good-first-issue` · `arr-001` · `arr-002` · `arr-003` · `arr-004`

---

## 19. Recommended Issue Templates

Create under `.github/ISSUE_TEMPLATE/` during Sprint 0 (issue #S0-03).

### `config.yml`

```yaml
blank_issues_enabled: false
contact_links:
  - name: Architecture escalation guide
    url: https://github.com/<org>/<repo>/blob/develop/docs/project/SIP_GITHUB_WORKFLOW.md#14-architecture-escalation-workflow
    about: Read before opening architecture-related work
```

### Templates to create

| File | Title | Labels applied |
|------|-------|----------------|
| `epic.yml` | Epic | `type:epic` |
| `feature.yml` | Feature | `type:feature` |
| `task.yml` | Task | `type:task` |
| `bug.yml` | Bug Report | `type:bug` |
| `adr.yml` | ADR Proposal | `type:adr`, `architecture` |
| `spike.yml` | Spike | `type:spike`, `architecture` |

Each template must include the required body sections from Section 8 as form fields or markdown placeholders.

### `feature.yml` (excerpt)

```yaml
name: Feature
description: User-visible or API-deliverable work
title: "[Feature] "
labels: ["type:feature"]
body:
  - type: textarea
    id: objective
    attributes:
      label: Objective
      description: What is delivered?
    validations:
      required: true
  - type: textarea
    id: architecture_refs
    attributes:
      label: Architecture references
      description: D-*, R-*, DM-*, API-*, ARR-*
      placeholder: "R-001, DM-002, ARR-001"
    validations:
      required: true
  - type: checkboxes
    id: modules
    attributes:
      label: Affected modules
      options:
        - label: applications
        - label: discovery
        - label: blueprints
        - label: assets
        - label: ontology
        - label: knowledge_graph
        - label: products
        - label: agents
        - label: agent_runtime
        - label: governance
        - label: adapters
        - label: audit_trace
        - label: platform_admin
        - label: core / shared
  - type: textarea
    id: acceptance_criteria
    attributes:
      label: Acceptance criteria
      description: Testable checklist
    validations:
      required: true
  - type: textarea
    id: out_of_scope
    attributes:
      label: Out of scope
    validations:
      required: true
```

### Pull request template

Create `.github/pull_request_template.md` with Section 11 required body sections.

---

## 20. Example Issues for Sprint 0

These examples are ready to paste into GitHub when the repository is configured. Parent epic: **E-01**.

---

### S0-01 — Configure GitHub Project and labels

**Type:** Task · **Surface:** docs · **Module:** n/a · **Priority:** P0

**Objective:** Create the `SIP MVP Delivery` GitHub Project with required columns, custom fields, and full label set (Section 18).

**Architecture references:** R-003 (monorepo governance)

**MVP scope reference:** N/A — delivery infrastructure (Tech Lead approved)

**Acceptance criteria:**

- [ ] Project `SIP MVP Delivery` exists with Board, Backlog, Sprint, Architecture, QA, Roadmap views
- [ ] Status field has columns: Backlog, Ready, In Progress, In Review, QA, Done
- [ ] All labels from Section 18 created
- [ ] Milestone `Sprint 0 — Project Foundation` created with due date

**Out of scope:** Issue template YAML (S0-03)

---

### S0-02 — Branch protection and merge policy

**Type:** Chore · **Surface:** infra · **Priority:** P0

**Objective:** Protect `main` and `develop`; enforce PR + CI before merge.

**Architecture references:** N/A — process (Playbook §6)

**Acceptance criteria:**

- [ ] `main` and `develop` require PR before merge
- [ ] Direct pushes blocked for both branches
- [ ] CI status check required before merge
- [ ] At least one human reviewer required (CODEOWNERS optional)

**Out of scope:** Deployment environments

---

### S0-03 — Issue and PR templates

**Type:** Task · **Surface:** docs · **Priority:** P0

**Objective:** Add GitHub issue templates and PR template per Section 19.

**Architecture references:** N/A

**Acceptance criteria:**

- [ ] Templates for epic, feature, task, bug, ADR, spike exist under `.github/ISSUE_TEMPLATE/`
- [ ] `config.yml` disables blank issues
- [ ] PR template includes acceptance criteria and architecture refs sections
- [ ] Sample issue validated through GitHub "New issue" UI

**Out of scope:** Automated field validation beyond templates

---

### S0-04 — Monorepo directory skeleton

**Type:** Task · **Surface:** cross-cutting · **Priority:** P0

**Objective:** Create monorepo folder layout per Implementation Guide and playbook.

**Architecture references:** R-001, R-003, ARR-003

**Affected modules:** `core` (scaffold all canonical module directories empty)

**Acceptance criteria:**

- [ ] Directories exist: `backend/app/core`, `backend/app/modules/<13 modules>`, `frontend/src`, `infra/kubernetes/base/`, `infra/kubernetes/overlays/dev/`, `docs`, `scripts`, `examples`
- [ ] `infra/kubernetes/` layout matches ADR-001 (`base/` for backend, postgres, ingress; `overlays/dev/`, `overlays/prod/`)
- [ ] Each module folder contains placeholder structure per Implementation Guide §5 (empty `api/`, `domain/`, `services/`, `repositories/`, `ports/`)
- [ ] `architecture/` path preserved for canonical `.docx` specs
- [ ] README or `docs/project/` links to playbook and this workflow doc

**Out of scope:** Business logic implementation

---

### S0-05 — FastAPI application bootstrap

**Type:** Task · **Surface:** backend · **Module:** core · **Priority:** P0

**Objective:** Runnable FastAPI app with `/api/v1` router mount, health check, settings.

**Architecture references:** R-001, API-002, ADR-001

**Acceptance criteria:**

- [ ] `backend/app/main.py` starts with uvicorn
- [ ] `/api/v1/health` returns 200 (local uvicorn and Kubernetes Deployment)
- [ ] Readiness and liveness probe endpoints defined for Kubernetes (ADR-001)
- [ ] Settings via environment variables (no secrets committed)
- [ ] Module router registration pattern documented for future modules

**Out of scope:** Module-specific routes

---

### S0-06 — PostgreSQL and Alembic baseline

**Type:** Task · **Surface:** backend · **Module:** core · **Priority:** P1

**Objective:** Alembic configured with initial migration; PostgreSQL runs in **`sip-dev`** via Kubernetes manifests (S0-07).

**Architecture references:** R-018 (RelationalDB port placeholder), ADR-001

**Dependencies:** S0-07

**Acceptance criteria:**

- [ ] Alembic env configured under `backend/`
- [ ] Initial migration runs against PostgreSQL in `sip-dev` namespace
- [ ] Migration rollback works
- [ ] Connection settings documented for Kubernetes Service DNS name

**Out of scope:** Domain table schemas

---

### S0-07 — Kubernetes Development Foundation

**Type:** Task · **Surface:** infra · **Priority:** P0

**Objective:** Deploy backend and PostgreSQL to local Kubernetes using Kustomize `dev` overlay. Establish the authoritative Sprint 0 runtime path per ADR-001.

**Architecture references:** R-001, R-003, R-018, ADR-001

**Dependencies:** S0-05, S0-10

**Acceptance criteria:**

- [ ] `kubectl apply -k infra/kubernetes/overlays/dev` deploys backend Deployment and PostgreSQL workload to `sip-dev`
- [ ] Backend Service exposes `/api/v1/health` with readiness and liveness probes
- [ ] PostgreSQL uses PersistentVolumeClaim where required
- [ ] ConfigMaps for non-secret config; Secret templates for credentials (no real secrets in manifests)
- [ ] Ingress (or documented port-forward) reaches health endpoint at `api.sip.local` or equivalent
- [ ] Placeholder directories under `infra/kubernetes/base/` for minio, qdrant, fuseki, openmetadata (not deployed)

**Out of scope:** Full adapter stack deployment; frontend Deployment

---

### S0-08 — CI pipeline baseline

**Type:** Chore · **Surface:** infra · **Priority:** P0

**Objective:** GitHub Actions workflow for lint, type check, and pytest on PRs to `develop`.

**Architecture references:** Playbook §14

**Acceptance criteria:**

- [ ] Workflow runs on PR to `develop` and push to `develop`
- [ ] Backend lint (ruff) and type check (mypy or pyright) configured
- [ ] Smoke pytest passes
- [ ] Status check name matches branch protection (S0-02)

**Out of scope:** Cluster deployment from CI (deferred); integration tests with external services

---

### S0-10 — Kubernetes namespace and Kustomize foundation

**Type:** Task · **Surface:** infra · **Priority:** P0

**Objective:** Create `sip-dev` namespace manifest, Kustomize `base/` and `overlays/dev/` structure per ADR-001.

**Architecture references:** R-003, ADR-001

**Dependencies:** S0-04

**Acceptance criteria:**

- [ ] `infra/kubernetes/base/kustomization.yaml` and `infra/kubernetes/overlays/dev/kustomization.yaml` exist
- [ ] Namespace resource defines `sip-dev`
- [ ] Base directories scaffolded: `backend/`, `postgres/`, `ingress/` (and placeholders for future services)
- [ ] `kubectl kustomize infra/kubernetes/overlays/dev` renders valid manifests
- [ ] Directory layout matches ADR-001

**Out of scope:** Application container images; full service implementations (S0-07)

---

### S0-11 — Kustomize validation in CI

**Type:** Chore · **Surface:** infra · **Priority:** P0

**Objective:** Add CI job that validates Kustomize manifests build cleanly on every PR.

**Architecture references:** ADR-001

**Dependencies:** S0-10

**Acceptance criteria:**

- [ ] CI runs `kubectl kustomize` (or `kustomize build`) on `infra/kubernetes/overlays/dev`
- [ ] CI runs `kubectl kustomize` on `infra/kubernetes/overlays/prod` (scaffold validation)
- [ ] Failing manifest syntax blocks merge
- [ ] Status check linked to branch protection (S0-02)

**Out of scope:** Deploy to cluster from CI

---

### S0-12 — Infrastructure README and Local Development Guide

**Type:** Task · **Surface:** docs · **Priority:** P1

**Objective:** Document Kubernetes-first local development workflow; Compose is optional fallback only.

**Architecture references:** ADR-001

**Dependencies:** S0-07, S0-10

**Acceptance criteria:**

- [ ] `infra/README.md` states Kubernetes + Kustomize as **primary** runtime
- [ ] Local Development Guide covers: cluster prerequisites, `sip-dev` namespace, `kubectl apply -k`, Ingress hosts (`api.sip.local`, `console.sip.local`)
- [ ] Health check verification steps documented
- [ ] Docker Compose explicitly labeled **non-authoritative** if mentioned
- [ ] Links to ADR-001 and this workflow doc

**Out of scope:** Production operations runbook

---

### S0-13 — Optional PostgreSQL Compose fallback (non-authoritative)

**Type:** Chore · **Surface:** infra · **Priority:** P3

**Objective:** Optional minimal PostgreSQL-only Compose file for developers who cannot use Kubernetes temporarily.

**Architecture references:** ADR-001

**Dependencies:** S0-07 (Kubernetes path must exist first)

**Acceptance criteria:**

- [ ] `infra/compose/` (or equivalent) contains PostgreSQL-only Compose file
- [ ] README and file header state **non-authoritative** and secondary to Kubernetes
- [ ] Does not duplicate full platform stack
- [ ] No production credentials in compose files

**Out of scope:** Making Compose the default dev path; backend in Compose

---

### S0-09 — Epic E-01 and Sprint 0 tracking

**Type:** Chore · **Surface:** docs · **Priority:** P2

**Objective:** Open epic E-01 and link all Sprint 0 issues; validate board workflow.

**Architecture references:** N/A

**Acceptance criteria:**

- [ ] Epic issue E-01 created with `type:epic`
- [ ] All S0-01–S0-13 linked as sub-issues or task list
- [ ] One issue driven through full column flow as workflow drill (can be this chore)
- [ ] Sprint 0 retrospective notes captured in epic comment

**Out of scope:** Sprint 1 planning

---

## Appendix A — Quick reference

| Need | Document |
|------|----------|
| Engineering quality gates | `docs/project/SIP_DEVELOPMENT_PLAYBOOK.md` |
| Module template | `SIP_Implementation_Guide_v1` §5 |
| Build order | `SIP_Implementation_Guide_v1` §17 |
| MVP demo | `SIP_MVP_Scope_v0_1` |
| Binding resolutions | `docs/architecture/SIP_Architecture_Review_Resolution_v1.md` |
| Deployment runtime | `docs/adr/ADR-001-cloud-native-deployment-strategy.md` |
| ADR format | Playbook §17 |

## Appendix B — Document history

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-25 | SIP PMO | Initial GitHub workflow definition |
| 1.1 | 2026-06-25 | SIP PMO | ADR-001 alignment: Kubernetes-first Sprint 0, updated issues S0-07–S0-13 |

---

*This document defines how SIP work flows through GitHub. For platform behavior, consult `architecture/`. For engineering standards, consult `SIP_DEVELOPMENT_PLAYBOOK.md`.*

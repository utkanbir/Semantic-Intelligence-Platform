# SIP Platform Console

React + TypeScript frontend for the Semantic Intelligence Platform (SIP).

**Architecture reference:** [docs/architecture/SIP_Software_Architecture_Guide.md](../docs/architecture/SIP_Software_Architecture_Guide.md)  
**Project state:** [docs/handoff.md](../docs/handoff.md)

## Prerequisites

- Node.js 20+
- Backend API running at `http://localhost:8000` (optional for bootstrap UI)

## Development

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The Vite dev server proxies `/api` to the backend at `http://localhost:8000` (override with `VITE_API_PROXY_TARGET`).

For direct API calls from the browser in production builds, set `VITE_API_BASE_URL` (default: `/api/v1`).

On `sip-dev`: http://console.sip.local (API at http://api.sip.local).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Type-check and production build |
| `npm run preview` | Preview production build |
| `npm run test` | Run Vitest unit tests |

## Structure

```
frontend/src/
  api/              # Typed API client helpers
  components/       # Shared UI (shell, layout, SemanticReviewPanel, …)
  pages/            # Route-level screens
  lib/              # Utilities, constants
```

Navigation follows **application-centric UX** (D-036): Applications are the primary entry point, not technology modules.

## Main routes (Sprint 35)

| Route | Page | Purpose |
|-------|------|---------|
| `/` | Home / hub | Platform entry |
| `/applications` | Applications list | Workspace list |
| `/applications/:id` | Application detail | Discovery, blueprint, ontology links |
| `/applications/:id/ontology/create` | Ontology Studio | Unified wizard (Manual / Import / Generate) |
| `/connectors` | Connectors hub | Unified connector registry |
| `/semantic-transactions` | Semantic transactions | Lineage list |
| `/semantic-transactions/:id` | Transaction detail | Trace steps |

Legacy `/ontology-studio` redirects to the application-scoped create route.

## Ontology wizard flow

1. **Mode select** — Manual, Import (file/paste), or Generate (URL/CSV/Excel/text)
2. **Draft edit** — Forms or parsed/extracted content
3. **Validate** — Deterministic errors block progress; LLM findings are advisory
4. **Semantic review** — `SemanticReviewPanel`: Accept/Ignore for `suggestion` findings only
5. **Connector** — Select graph-store connector (Fuseki)
6. **Approve → Materialize** — Graph write only after explicit approval

Key files:

- `src/pages/OntologyStudioPage.tsx` — wizard orchestration
- `src/components/SemanticReviewPanel.tsx` — LLM suggestion decisions

## Tests

```bash
npm run test
```

Vitest covers components and API client helpers where behavior is non-trivial.

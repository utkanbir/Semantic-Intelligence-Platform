# SIP Platform Console

React + TypeScript frontend for the Semantic Intelligence Platform (SIP).

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

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Type-check and production build |
| `npm run preview` | Preview production build |
| `npm run test` | Run Vitest unit tests |

## Structure

```
frontend/
  src/
    components/   # Shared UI (shell, layout)
    pages/        # Route-level screens
```

Navigation follows application-centric UX (D-036): Applications are the primary entry point, not technology modules.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`rivo-app` is the frontend for RIVO: a visual, canvas-based builder for AWS infrastructure diagrams. Users drag AWS service nodes (Lambda, API Gateway, DynamoDB, VPC, etc.) onto a canvas, wire them together, and save the resulting graph as a project. It's a React 19 + Vite + TypeScript + Tailwind v4 SPA.

This repo currently has almost no commit history and a large uncommitted working tree — don't assume `git log`/`git blame` reflect authorship or stability of what you're editing.

### No live backend right now

The original `rivo-api` (Go Lambda) backend has been **disconnected on purpose** — it's being replaced by new lambdas that are being built separately, incrementally. Until those exist, the frontend runs entirely on dummy data:

- `src/services/mockStore.ts` is a tiny in-browser fake database (seeded data + `localStorage` persistence under the `rivo_mock_db` key) that `src/services/{auth,projects,spaces}.ts` read/write instead of calling a real API. The exported shapes (`AuthTokens`, `ApiSpace`, `ApiProject`, `ApiProjectDetail`) and the `authService`/`projectsService`/`spacesService` function signatures are kept identical to what they were when backed by `fetch`, specifically so a given service module can be swapped back to real `api.get/post/put/del` calls one lambda at a time without touching any calling component.
- `src/services/api.ts` now only exports `ApiError` (kept for call sites that catch it) — its `fetch` wrapper and `VITE_API_URL` usage were removed. Restore the wrapper there when the first real endpoint is ready.
- `src/features/canvas/useServices.ts` (the `GET /services` catalog hook) is a no-op returning an empty state — the canvas already had full static-fallback support built in (`aws-services.tsx` for the catalog, `service-config-schemas.ts` for per-field schemas), so nothing else needed to change for the canvas itself to keep working.
- Auth is fully fake: `authService.login` accepts any email/password and mints a decodable-but-unsigned JWT-shaped ID token, so `AuthContext`'s client-side JWT decoding keeps working. There's no real Cognito call, confirmation check, or password validation anymore.

When wiring in a real lambda, prefer replacing one service module's internals at a time (e.g. `spaces.ts` first) over a big-bang rewrite — that's the incremental path this mock layer was built to support.

## Commands

All commands run from the `rivo-app/` root.

```bash
npm run dev              # vite dev server
npm run build             # tsc -b (project references) && vite build
npm run lint               # eslint .
npm run preview            # preview a production build
npm run storybook          # storybook dev server on :6006
npm run build-storybook    # static storybook build
```

There is no plain unit-test script. `vitest`/`@storybook/addon-vitest`/`playwright` are wired only as a Storybook interaction-test runner (see `vite.config.ts` → `test.projects[0]`, which points at `.storybook` and runs component stories in a headless Chromium browser via `@vitest/browser-playwright`). To run it: `npx vitest`. There's no non-Storybook test suite — if you add plain unit tests you'll need to add a project/config for them.

`npm run build` runs `tsc -b` first — TypeScript project references mean the real compiler options live in `tsconfig.app.json` (app code, strict, `noUnusedLocals`/`noUnusedParameters`, `verbatimModuleSyntax`) and `tsconfig.node.json` (config files like `vite.config.ts`); the root `tsconfig.json` only wires up the references.

No `.env` is required right now — `VITE_API_URL` is unused while the app runs on dummy data (see "No live backend right now" above); `.env.example` documents it commented out for when a real API exists again.

### Frontend hosting infra (`infra/`)

`infra/` is a **separate, self-contained Terraform config** (S3 + CloudFront static hosting for the built SPA) with its own state, own `Makefile`, and its own `dev`/`prod` tfvars — independent of any backend Terraform. Always check which directory you're in before running `terraform`/`make` commands.

```bash
cd infra
make dev-plan / make dev-apply     # plan/apply against environments/dev.tfvars
make prod-plan / make prod-apply   # plan/apply against environments/prod.tfvars
make upload                         # sync ../dist/ to S3 (run `npm run build` first)
make invalidate                     # invalidate the CloudFront distribution
make deploy                         # upload + invalidate
```

## Architecture

### Data flow: canvas state ↔ wire format ↔ API

There are two distinct shapes for the same diagram, and confusing them is a common source of bugs:

- **`CanvasNode` / `CanvasEdge`** (`src/features/canvas/useCanvas.ts`) — the live, editable in-memory state the canvas UI works with. Nodes carry UI-only fields like `variant` (`"service" | "container"`), `size`, and `parentId` (for nodes nested inside a region/VPC/subnet container).
- **`InfraModel`** (`src/types/infra.ts`) — the serialized wire format (`{ version, nodes: [{id, type, position, config}], edges: [{id, source, target, type}] }`) meant for a real API. `useCanvas().toJSON()` converts state → wire format; `projectsService.update()`/`.get()` currently read/write that same shape into the dummy store in `mockStore.ts` instead, and the caller (`CanvasPage`) feeds a loaded model back into `useCanvas().resetCanvas()` exactly as it would from a real backend.

`CanvasPage` (`src/pages/CanvasPage.tsx`) is the orchestrator: it owns `useCanvas()` state, loads a project by `:id` on mount, tracks dirtiness by diffing a JSON snapshot of nodes/edges against the last-saved snapshot, and wires the canvas, side panels, and modals together.

### Canvas rendering is hand-rolled, not a graph library

`src/features/canvas/CanvasArea.tsx` and friends (`nodes/ServiceNode.tsx`, `nodes/ContainerNode.tsx`, `edges/EdgeLayer.tsx`) implement panning, zooming, dragging, resizing, and drag-to-connect entirely by hand — there is no react-flow/xyflow or similar dependency. Container-type nodes (`region`, `vpc`, `subnet`) can parent other nodes (`parentId`); moving a container drags its children by the same delta (see `moveNode` in `useCanvas.ts`).

Edge semantics are type-pair driven: `src/features/canvas/edgeKinds.ts` resolves what (if any) config panel to show for a selected edge based on the sorted pair of connected node types (`pairKey`). Currently only `api-gateway`+`lambda` is configurable (renders `EdgeConfigPanel` as a "route"). To support a new relationship (e.g. `lambda`+`dynamodb`), add its pair to `CONFIGURABLE_PAIRS` and a case to `resolveEdgeKind`.

Certain node types get an additional docked `RightPanel` (currently `lambda`, `api-gateway` — see `RIGHT_PANEL_SERVICES` in `CanvasPage.tsx`) with per-service detail panels (`RightPanel/LambdaPanel.tsx`, `RightPanel/ApiGatewayPanel.tsx`) and Lambda-specific modals for code/zip upload (`modals/CodeModal.tsx`, `modals/ZipModal.tsx`).

### Service catalog: static fallback (currently the only source)

`src/features/canvas/aws-services.tsx` has a static, hardcoded catalog (icons, categories, default configs/sizes) that the canvas is entirely driven by right now, since `useServices.ts` is a no-op (see "No live backend right now"). Per the comment in `service-config-schemas.ts`, per-field config schemas (`SERVICE_SCHEMAS`) were designed to eventually come from a server; today they're still hardcoded client-side and are the only source in use.

### API/auth layer

- `src/services/api.ts` — only exports `ApiError` now; the old `fetch` wrapper (`api.get/post/put/del`), bearer-token attachment from `localStorage["rivo_id_token"]`, and 401 handling were removed along with the backend connection. Restore it here when wiring in a real lambda.
- `src/services/{auth,projects,spaces}.ts` — per-resource service modules with the same exported shapes as before, now backed by `src/services/mockStore.ts`'s dummy data instead of `api`. `projects.ts` also derives a deterministic per-project accent color from the project id (`projectAccentColor`).
- `src/store/appCache.ts` — `makeCache<T>()`, a tiny module-level in-memory TTL cache (default 5 min) used to avoid refetching lists (e.g. `projectsCache` in `services/projects.ts`) across navigations without a full state-management library.
- `src/context/AuthContext.tsx` — auth state (`rivo_token` access token, `rivo_id_token` ID token, both in `localStorage`), unchanged in shape even though `authService` now mints fake tokens instead of calling Cognito. User identity is derived client-side by decoding the ID token's JWT payload (`decodeJwt`/`userFromToken`). `src/router/ProtectedRoute.tsx` gates authenticated routes by redirecting to `/login` via `<Navigate>`.

### Routing

`src/router/Router.tsx` is the single source of truth for routes: public auth routes wrapped in `AuthLayout`, and everything else behind `ProtectedRoute` + `AppLayout`. `SnackbarProvider`/`AuthProvider` wrap the whole tree above the router outlet.

### Styling

Tailwind v4, configured entirely in CSS (`src/index.css`) via `@theme` — there is no `tailwind.config.js`. Semantic color tokens (`--color-page`, `--color-card`, `--color-ink`, etc.) are defined once and mapped to `--theme-*` custom properties that swap between `:root.dark` (default) and `:root.light` via `@custom-variant dark`. Prefer the semantic utility classes (`bg-page`, `bg-card`, `text-ink`, `border-edge`, ...) over raw Tailwind color utilities so components stay theme-aware.

### Storybook

Stories are colocated with components as `*.stories.tsx` (e.g. `src/components/Button/Button.stories.tsx`). Storybook config lives in `.storybook/`. React Compiler is enabled project-wide via `@rolldown/plugin-babel` + `reactCompilerPreset` in `vite.config.ts`, so it applies inside Storybook too, not just the app build.

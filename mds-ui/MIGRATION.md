# LightDash React → Angular migration plan

Big-bang frontend replacement. Backend (`packages/backend`), shared types (`packages/common`), CLI, and warehouses are out of scope.

## Scale (reference clone)

| Area | Size |
|------|------|
| `packages/frontend/src/` | ~359k LOC, ~2,113 TS/TSX files |
| React Query hooks | ~215 in `src/hooks/` |
| Feature modules | ~535 files in `src/features/` |
| EE (commercial) | ~410 files in `src/ee/` |

## Angular stack mapping

| React (LightDash) | Angular (this repo) |
|-------------------|---------------------|
| Mantine v6/v8 | Angular Material |
| TanStack Query v4 | `HttpClient` + RxJS; consider `@tanstack/angular-query-experimental` later |
| Redux Toolkit (feature-local) | Signals + injectable stores per feature |
| React Router 7 | Angular Router (lazy routes) |
| CASL (`@casl/react`) | `@casl/angular` |
| `lightdashApi` fetch wrapper | `LightdashApiService` |
| `@lightdash/common` types | File dependency or published package (recommended) |
| ECharts / Vega / Monaco / xyflow | `ngx-echarts`, direct Vega embed, Monaco wrapper, TBD for lineage |

## Reuse `@lightdash/common`

The React app imports hundreds of types from the monorepo package. Options:

1. **File dependency (dev):** build `reference/lightdash/packages/common` and add to `package.json`:
   ```json
   "@lightdash/common": "file:reference/lightdash/packages/common"
   ```
2. **OpenAPI codegen:** generate a client from `packages/backend/src/generated/swagger.json` (backend has spec; frontend does not use it today).
3. **Gradual copy:** duplicate types only as each feature is ported (slowest, most drift risk).

Recommendation: option 1 for parity, option 2 long-term for API typing.

## Route inventory (port in this order)

### Phase 0 — Foundation (current)
- [x] Angular + Material scaffold
- [x] `LightdashApiService`, health bootstrap, auth guard skeleton
- [ ] Wire `@lightdash/common`
- [ ] Login / register / password flows
- [ ] CASL ability provider

### Phase 1 — Auth & shell (~2 weeks)
- `/login`, `/register`, `/recover-password`, `/reset-password/:code`
- `/invite/:inviteCode`, `/verify-email`, `/join-organization`
- App shell: navbar, project switcher, user menu
- `/projects`, `/createProject/:method?`

### Phase 2 — Project core (~4–6 weeks)
- `/projects/:projectUuid/home`
- `/projects/:projectUuid/tables` (Explorer)
- `/projects/:projectUuid/saved` (saved charts)
- `/projects/:projectUuid/dashboards`
- `/projects/:projectUuid/spaces`

### Phase 3 — Power features (~8+ weeks)
- SQL Runner + Monaco
- Metrics catalog
- Chart builder / DataViz (ECharts, Vega)
- Dashboard grid + filters + tabs
- Scheduler, comments, export

### Phase 4 — Advanced & EE
- Source code editor, lineage (xyflow)
- Apps builder, funnel builder
- Embed routes, AI agents (if in scope)
- Mobile route subset

## High-risk areas

1. **Chart / visualization config** — large Redux slices in `components/DataViz/store/`
2. **Dashboard drag-and-drop** — `react-grid-layout` → Angular CDK or alternative
3. **SQL Runner** — Monaco + warehouse dialects + Redux store
4. **Metrics catalog** — 90 files, complex state
5. **Embed SDK** — separate bundle; may stay React or become web components

## Dev workflow

1. Run LightDash backend from reference clone (`./scripts/install.sh` or Docker).
2. Run this app: `npm start` (proxies `/api` → backend).
3. Port one React page at a time; match URL paths exactly so deep links keep working.
4. Use Cypress tests in `reference/lightdash/packages/e2e/` as acceptance criteria when possible.

## Deployment (big-bang cutover)

Production LightDash serves the frontend static bundle from the backend container. At cutover:

1. Build Angular: `npm run build` → `dist/lightdash-angular/browser/`
2. Replace the React build artifact in the backend Docker image / static mount.
3. Verify all routes fall back to `index.html` (SPA).

Coordinate with backend team on `BASE_URL` and cookie/session domains.

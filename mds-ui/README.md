# LightDash Angular → MDS UI

Angular + Material frontend for the MDS Data Platform. Lives in the **mds-ui/** folder of the monorepo.

## Prerequisites

- Node.js **^20.19**, **^22.12**, or **>=24** (matches `@angular/cli` / Nx 23; use `nvm use` in `mds-ui/` — see `.nvmrc`)
- For real API mode: running **mds-backend** + Postgres (see repo root README)

## Quick start

```bash
cd mds-ui
npm install
npm start
```

This runs `nx serve shell --open`. Open `http://localhost:4200` if the browser does not open automatically.

Default `apps/shell/src/environments/environment.ts` has **`useMockApi: false`**, so the app talks to the backend via `proxy.conf.json` (port `8080`). On a fresh database you will land on **`/setup`** (create first admin), then use **`/login`** thereafter.

If port 4200 is already in use, stop the existing process (`lsof -i :4200`) or run `npx nx serve shell --port 4201` and open the matching URL.

### Real backend (default)

1. Start postgres + backend (see repo root README; install backend with `pip install -e ".[dev,dbt]"`).
2. Keep `useMockApi: false` in `apps/shell/src/environments/environment.ts`.
3. Complete `/setup` once, or sign in at `/login`.
4. Browse projects at `/projects`. Workspace admin (projects, warehouses, users) lives under **`/settings/*`**.

### Mock mode (no backend)

Set `useMockApi: true` in `apps/shell/src/environments/environment.ts`. Requests to `/api/v1/*` (and related) are intercepted and served from in-memory fixtures in `apps/shell/src/app/core/mock/`. Useful for UI-only work; mock auth routes exist but do not mirror full production auth.

## Main routes

| Path | Purpose |
|------|---------|
| `/setup` | First-run admin account (empty DB) |
| `/login` | Sign in |
| `/reset-password` | Set password from CLI/admin reset token or must-change flow |
| `/projects` | Project browse home |
| `/settings/*` | Settings shell: projects, warehouses, users (admin) |
| `/projects/:uuid/dashboards`, `/charts`, `/tables`, `/lineage` | Project workspace |

## Nx project layout

```
apps/shell/             # Nx application project (tagged type:app)
  src/app/
    core/
      api/           # LightdashApiService, types
      guards/        # auth / guest / admin / setup / reset-password
      interceptors/  # mock + auth (401 → login)
      mock/          # Mock interceptor, router, fixtures
      services/      # AppStateService, AuthService
    features/        # auth, projects, settings, charts, dashboards, explorer, …
    layout/          # App shell, navbar, settings sidebar
```

## Migration phases

See [MIGRATION.md](./MIGRATION.md) for the full route inventory, stack mapping, and phased plan. Login/setup/password reset and Settings shell are implemented; CASL/SSO/OpenFGA are design-only (see `docs/superpowers/specs/`).

## Reference source

Clone upstream LightDash locally for side-by-side porting (not committed):

```bash
git clone --depth 1 https://github.com/lightdash/lightdash.git reference/lightdash
```

React source to port lives in `reference/lightdash/packages/frontend/`.

## Stack

| Layer | Choice |
|-------|--------|
| Framework | Angular 19 (standalone components, signals) |
| UI | Angular Material |
| HTTP | `HttpClient` + `LightdashApiService` + optional mock interceptor |
| Auth | Cookie session via backend; route guards + `AuthService` |
| State | Signals + feature services (NgRx only where needed) |
| Charts | ECharts / Vega (per feature) |

## License

Match upstream LightDash licensing when publishing. This is an independent migration effort unless contributed back to the main project.

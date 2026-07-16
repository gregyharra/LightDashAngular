# Dashboard backend documentation

This folder documents how to implement a **FastAPI** backend for the dashboard feature already built in the Angular frontend.

## What the frontend implements today

| Capability | Angular location |
|---|---|
| List dashboards | `DashboardsListPageComponent` → `GET /projects/{projectUuid}/dashboards` |
| Create dashboard | `DashboardCreatePageComponent` → `POST /projects/{projectUuid}/dashboards` |
| View dashboard | `DashboardViewPageComponent` → `GET /projects/{projectUuid}/dashboards/{dashboardUuid}` (v2) |
| Edit dashboard (tabs, tiles, layout) | `DashboardEditPageComponent` → `PATCH /projects/{projectUuid}/dashboards/{dashboardUuid}` (v2) |
| Grid layout engine (drag/resize, collision resolution) | `dashboard-grid-layout.ts`, `dashboard-tile-grid-interaction.directive.ts` |

The frontend expects the **LightDash API envelope** (`{ status, results }`) and uses **API v1** for list/create and **API v2** for get/update.

## Documents

1. **[FastAPI API specification](./fastapi-api-spec.md)** — endpoints, request/response schemas, validation rules, and example FastAPI code.
2. **[Database strategy](./database-strategy.md)** — relational schema, versioning approach, JSONB for tile properties, and migration guidance.

## Quick compatibility checklist

- [ ] All responses wrapped in `{ "status": "ok", "results": ... }` or `{ "status": "error", "error": { ... } }`
- [ ] `GET` and `PATCH` dashboard detail served on `/api/v2/projects/{projectUuid}/dashboards/{dashboardUuid}`
- [ ] `GET` list and `POST` create served on `/api/v1/projects/{projectUuid}/dashboards`
- [ ] Grid coordinates: `x`, `y`, `w`, `h` integers; grid is **36 columns** wide
- [ ] Tile `properties` shape varies by `type` (`saved_chart`, `markdown`, `heading`)
- [ ] `PATCH` replaces the full `tabs` and `tiles` arrays (not partial tile updates)
- [ ] `dashboardVersionId` increments and `versionUuid` rotates on each successful update
- [ ] CORS + cookie/session auth if matching the existing `withCredentials: true` client

## Suggested implementation order

1. Stand up FastAPI with the response envelope middleware.
2. Create the database schema (see database strategy).
3. Implement `GET` list + `POST` create (v1).
4. Implement `GET` detail (v2) — unblocks view page.
5. Implement `PATCH` update (v2) — unblocks edit/save flow.
6. Add server-side layout validation (optional but recommended).
7. Point the Angular app at the backend (`useMockApi: false` in `environment.ts`).

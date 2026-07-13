# LightDash Angular

Angular + Material rewrite of the [LightDash](https://github.com/lightdash/lightdash) frontend. The existing Node/Express backend and `@lightdash/common` package stay unchanged; this repo replaces `packages/frontend` in a big-bang migration.

## Prerequisites

- Node.js 18.19+ or 20+
- **No backend required** for local UI development (mock API is enabled by default)

## Quick start

```bash
npm install
npm start
```

Open `http://localhost:4200/projects`. The dev server auto-opens the browser.

If port 4200 is already in use, stop the existing process (`lsof -i :4200`) or run `ng serve --port 4201` and open the matching URL.

### Mock mode (default)

`src/environments/environment.ts` sets `useMockApi: true`. All `/api/v1/*` requests are intercepted and served from in-memory fixtures in `src/app/core/mock/`. No sign-in is required.

To connect to a real LightDash backend instead:

1. Set `useMockApi: false` in `environment.ts`
2. Start LightDash on port `8080` (proxied via `proxy.conf.json`)

## Reference source

Clone upstream LightDash locally for side-by-side porting (not committed):

```bash
git clone --depth 1 https://github.com/lightdash/lightdash.git reference/lightdash
```

React source to port lives in `reference/lightdash/packages/frontend/`.

## Project layout

```
src/app/
  core/
    api/           # LightdashApiService
    mock/          # Mock interceptor, router, fixtures
    services/      # AppStateService (health + user bootstrap)
  features/        # Domain modules (projects, charts, …)
  layout/          # App shell
```

## Migration phases

See [MIGRATION.md](./MIGRATION.md) for the full route inventory, stack mapping, and phased plan.

## Stack

| Layer | Choice |
|-------|--------|
| Framework | Angular 19 (standalone components, signals) |
| UI | Angular Material |
| HTTP | `HttpClient` + `LightdashApiService` + mock interceptor |
| State | Signals + feature services (NgRx only where needed) |
| Charts | ECharts / Vega (TBD per feature) |

## License

Match upstream LightDash licensing when publishing. This is an independent migration effort unless contributed back to the main project.

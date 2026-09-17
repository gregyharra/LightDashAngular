# Task 5 Report — Extract `libs/core`

## Status

DONE

## Commit

- `0b4e3b1 refactor(ui): extract @mds-ui/core library`

## Implementation

- Finished the existing Nx Angular library WIP at `mds-ui/libs/core`, retaining the required `@mds-ui/core` alias and `type:core` tag.
- Moved the shell core API, guard, interceptor, i18n, service, store, utility, mock fixture, and existing source test files into `libs/core/src/lib`.
- Rewrote shell imports to consume the public `@mds-ui/core` barrel and removed `apps/shell/src/app/core`.
- Exported all required API, guard, interceptor, i18n, service, store, UUID, and mock-interceptor symbols from `libs/core/src/index.ts`.
- Removed the mock interceptor's dependency on the shell environment. Core now exposes `MOCK_API_ENABLED`; shell supplies `environment.useMockApi` through dependency injection. Added two tests covering enabled and disabled mock modes.
- Kept the application-owned i18n catalog integrity test in the shell because it imports shell assets; this avoids a core-to-app dependency.
- Added the library's Angular Material and `@mds-ui/models` peer dependencies required by Nx dependency checks.

## Boundary review

- `nx graph --print` reports exactly one workspace dependency for `core`: a static dependency on `models`.
- No production import from core to shell, feature, shared, layout, or UI code remains.
- No old relative shell imports into `app/core` remain.
- The existing WIP had moved `ChartService`, `ExplorerService`, dashboard filter utilities, dbt explore conversion, and time-travel utilities into the allowed `services/` and `utils/` areas. This is necessary because `ChartQueryLoader` uses them; keeping them in features would create a forbidden core-to-feature dependency. No additional top-level core area was introduced.

## Verification

- `npx nx test core --watch=false` — PASS, 36/36.
- `npx nx test shell --watch=false` — PASS, 172/172.
- `npx nx lint core` — PASS with 3 existing unused-variable warnings.
- `npx nx lint shell` — FAILS on pre-existing accessibility/template and unused-expression findings in files/lines unrelated to the import extraction. No boundary/import error was reported.
- `npx nx build shell --configuration=development` — PASS; it also built `models` and `core`. Two existing Angular unused-`RouterLink` warnings remain.
- `git diff --check` — PASS.
- Commit inspection found no `out-tsc`, `dist`, `.tmp`, environment, or secret file committed.

## Remaining worktree state

- `mds-ui/.vscode/extensions.json` and `mds-ui/package-lock.json` remain modified but uncommitted. They were generator side effects already present in the Task 5 WIP and were intentionally excluded by the task's exact staging command.
- This report is intentionally written after the implementation commit.

## Review fixes

- Restored `ChartService` to `features/charts`, `ExplorerService` plus dbt/time-travel utilities to `features/explorer`, and dashboard filter utilities/tests to `features/dashboards`.
- Removed those feature exports and files from `@mds-ui/core`.
- Added the models-only `CHART_QUERY_ADAPTER` interface/token in core. `ChartQueryLoader` now depends only on that core contract; the shell composition root supplies feature services and query transforms.
- Kept core mock fixtures self-contained so they do not import shell feature paths.
- `nx graph --print` reports `core -> models` as core's only workspace dependency. A source scan found no core import of shell or feature paths.

## Review-fix verification

- `npx nx test core --watch=false` — PASS, 21/21. The first attempt compiled but Chrome disconnected before execution; a fresh retry passed and Nx marked the initial run flaky.
- `npx nx test shell --watch=false` — PASS, 187/187 in Chrome and Electron (374 total).
- `npx nx lint core` — PASS with 2 pre-existing unused-variable warnings and no errors.
- `npx nx build shell --configuration=development` — PASS; two existing unused-`RouterLink` warnings remain.
- `npx nx graph --print` — PASS; core has one static workspace dependency, `models`.
- `npx nx serve shell --port 4200` plus `curl http://localhost:4200/` — PASS, HTTP 200 HTML containing `<app-root>`. The serve process was stopped afterward.
- Login/setup and backend-backed flows were not fully exercised by this runtime smoke test.
- `git diff --check` — PASS.

# MDS UI Nx Module Federation Remotes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Prerequisite:** `docs/superpowers/plans/2026-09-16-mds-ui-nx-foundation.md` is fully complete (Nx `shell` + `@mds-ui/models|core|shared` + boundaries + Tailwind).

**Goal:** Peel each major feature into a Module Federation remote with NgRx store + facades, while the shell owns routing and stays shippable after every remote.

**Architecture:** Shell is the MF host. Each remote is `type:app`, exposes an entry component + routes, and must not import other remotes. Cross-remote needs go through `@mds-ui/models`, `@mds-ui/core`, `@mds-ui/shared`, or a new `@mds-ui/feature-*` library. Components talk to facades only.

**Tech Stack:** Nx Module Federation (`@nx/angular` host/remote generators or Angular-compatible MF plugin matching installed Nx), Angular 20, NgRx 20, Material + Tailwind (shell styles), Karma/Jasmine, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-16-mds-ui-nx-module-federation-architecture-design.md`

## Global Constraints

- All Global Constraints from the foundation plan still apply.
- Remotes must not import other remotes.
- Never tag feature libs as `type:shared`.
- Shell routes remain the source of truth; remotes export route arrays / entry modules for the shell to load.
- After each remote peel: `nx serve shell` (with remotes) works; lint boundaries pass; touched unit tests pass; Playwright smoke if available.
- Facades are mandatory before a remote is marked done — no direct `Store` inject in components.
- Path aliases for new feature libs: `@mds-ui/feature-<name>`.
- Prefer thin facades wrapping existing services first; deepen reducers as needed for UI state.

---

## File structure (locked)

| Path | Responsibility |
|------|----------------|
| `mds-ui/apps/shell/module-federation.config.ts` (or webpack MF config as generated) | Host remotes map |
| `mds-ui/apps/shell/src/app/app.routes.ts` | Composes remote routes |
| `mds-ui/apps/remote-auth/` | Auth pages remote |
| `mds-ui/apps/remote-projects/` | Projects + settings shell remote |
| `mds-ui/apps/remote-warehouses/` | Warehouses remote |
| `mds-ui/apps/remote-tables/` | Table hub remote |
| `mds-ui/apps/remote-explorer/` | Explorer remote |
| `mds-ui/apps/remote-charts/` | Charts remote |
| `mds-ui/apps/remote-dashboards/` | Dashboards remote |
| `mds-ui/apps/remote-lineage/` | Lineage remote |
| `mds-ui/apps/remote-ai/` | AI assistant remote |
| `mds-ui/apps/remote-export/` | Export dialog/service remote |
| `mds-ui/libs/feature-chart-query/` | Optional: shared chart-query NgRx feature if explorer/charts/dashboards all need it (`type:feature`) |

Internal remote layout (every remote):

```text
apps/remote-<name>/src/
  index.ts                    # public remote entry exports
  app/
    <name>-entry.component.ts
    <name>.routes.ts
    pages|…                   # feature UI (moved)
    core/
      store/
      services/               # if not moved to libs/core
      facades/
    models/                   # feature-only types (optional)
    shared/                   # feature-only UI (optional)
```

---

### Task 1: Enable Module Federation on `shell` (host only)

**Files:**
- Create: MF host config under `apps/shell/` (exact filenames per Nx generator)
- Modify: `apps/shell/project.json` serve/build executors for MF
- Test: serve still loads the monolith features (no remotes registered yet, or empty remotes map)

**Interfaces:**
- Consumes: foundation `shell` app
- Produces: `shell` as MF host; remotes map ready to extend

- [ ] **Step 1: Worktree / branch**

```bash
cd /Users/gregoire/Documents/0\ Personal/LightDashAngular
git worktree add .worktrees/mds-ui-nx-remotes -b feat/mds-ui-nx-remotes
cd .worktrees/mds-ui-nx-remotes/mds-ui
```

(Or continue on the foundation branch if not yet merged.)

- [ ] **Step 2: Setup host MF**

```bash
npx nx g @nx/angular:setup-mf shell --mfType=host --routing=false
```

If the generator name differs in the installed Nx version, use the documented host setup for that version (`setup-mf` / `host` generator). Do **not** delete existing routes — merge MF wiring with current `app.routes.ts`.

- [ ] **Step 3: Verify empty-host serve**

```bash
npx nx serve shell --port 4200
```

Expected: existing features still load from shell source (not yet moved).

- [ ] **Step 4: Commit**

```bash
git add mds-ui/apps/shell mds-ui/package.json mds-ui/package-lock.json
git commit -m "$(cat <<'EOF'
chore(ui): enable Module Federation host on shell

Prepare the shell as MF host before peeling feature remotes.
EOF
)"
```

---

### Task 2: Extract `remote-auth` with store + facades

**Files:**
- Create: `mds-ui/apps/remote-auth/**`
- Move from: `apps/shell/src/app/features/auth/**`
- Note: `users-page` lives under auth today but is routed under settings — move it with this remote and load it from shell settings children via remote routes, **or** move `users-page` with `remote-projects` if that keeps settings cohesion. **Decision locked:** keep `users-page` in `remote-auth` (auth domain); shell settings route lazy-loads that remote route.
- Create facades/store under remote
- Modify: `apps/shell/src/app/app.routes.ts`, MF remotes map
- Test: facade specs + existing page specs updated to mock facades

**Interfaces:**
- Consumes: `AuthService`, guards from `@mds-ui/core`
- Produces:
  - `AUTH_REMOTE_ROUTES: Routes` from `apps/remote-auth/src/app/auth.routes.ts`
  - `AuthEntryComponent`
  - `LoginPageFacade` with:
    - `readonly submitting: Signal<boolean>`
    - `readonly error: Signal<string | null>`
    - `login(payload: LoginPayload): void`
  - `SetupPageFacade` with `submitting`, `error`, `setup(payload: SetupPayload): void`
  - `ResetPasswordPageFacade` with methods matching current page behavior (expose `submitting`, `error`, and the password-submit intent used today)
  - `UsersPageFacade` wrapping user list/create/update/delete intents currently on `UsersPageComponent` via `AuthService`

- [ ] **Step 1: Generate remote**

```bash
npx nx g @nx/angular:remote remote-auth --host=shell --tags=type:app
```

Ensure `apps/remote-auth/project.json` has `"tags": ["type:app"]`.

- [ ] **Step 2: Write failing facade test**

Create `apps/remote-auth/src/app/core/facades/login-page.facade.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideStore } from '@ngrx/store';
import { of, throwError } from 'rxjs';
import { AuthService, LoginPayload } from '@mds-ui/core';
import { LoginPageFacade } from './login-page.facade';
import { authUiFeature } from '../store/auth-ui.reducer';

describe('LoginPageFacade', () => {
  it('sets error when login fails', () => {
    const auth = {
      login: () => throwError(() => ({ error: { message: 'Nope' } })),
    };

    TestBed.configureTestingModule({
      providers: [
        provideStore({ [authUiFeature.name]: authUiFeature.reducer }),
        LoginPageFacade,
        { provide: AuthService, useValue: auth },
      ],
    });

    const facade = TestBed.inject(LoginPageFacade);
    facade.login({ email: 'a@b.c', password: 'x' } satisfies LoginPayload);
    expect(facade.error()).toBe('Nope');
    expect(facade.submitting()).toBe(false);
  });

  it('clears error and toggles submitting on success path start', () => {
    const auth = {
      login: () => of({ mustChangePassword: false }),
    };

    TestBed.configureTestingModule({
      providers: [
        provideStore({ [authUiFeature.name]: authUiFeature.reducer }),
        LoginPageFacade,
        { provide: AuthService, useValue: auth },
      ],
    });

    const facade = TestBed.inject(LoginPageFacade);
    facade.login({ email: 'a@b.c', password: 'x' });
    expect(facade.error()).toBeNull();
  });
});
```

- [ ] **Step 3: Run test — expect FAIL**

```bash
npx nx test remote-auth --watch=false --testPathPattern=login-page.facade
```

Expected: FAIL (facade/store missing).

- [ ] **Step 4: Implement auth UI store + LoginPageFacade**

`apps/remote-auth/src/app/core/store/auth-ui.actions.ts`:

```ts
import { createActionGroup, emptyProps, props } from '@ngrx/store';

export const AuthUiActions = createActionGroup({
  source: 'Auth UI',
  events: {
    'Login Started': emptyProps(),
    'Login Succeeded': emptyProps(),
    'Login Failed': props<{ message: string }>(),
    'Clear Error': emptyProps(),
  },
});
```

`apps/remote-auth/src/app/core/store/auth-ui.reducer.ts`:

```ts
import { createFeature, createReducer, on } from '@ngrx/store';
import { AuthUiActions } from './auth-ui.actions';

export interface AuthUiState {
  submitting: boolean;
  error: string | null;
}

const initialState: AuthUiState = { submitting: false, error: null };

export const authUiFeature = createFeature({
  name: 'authUi',
  reducer: createReducer(
    initialState,
    on(AuthUiActions.loginStarted, (s) => ({ ...s, submitting: true, error: null })),
    on(AuthUiActions.loginSucceeded, (s) => ({ ...s, submitting: false })),
    on(AuthUiActions.loginFailed, (s, { message }) => ({
      ...s,
      submitting: false,
      error: message,
    })),
    on(AuthUiActions.clearError, (s) => ({ ...s, error: null })),
  ),
});
```

`apps/remote-auth/src/app/core/facades/login-page.facade.ts`:

```ts
import { Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService, LoginPayload } from '@mds-ui/core';
import { AuthUiActions } from '../store/auth-ui.actions';
import { authUiFeature } from '../store/auth-ui.reducer';

@Injectable()
export class LoginPageFacade {
  private readonly store = inject(Store);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly submitting = this.store.selectSignal(authUiFeature.selectSubmitting);
  readonly error = this.store.selectSignal(authUiFeature.selectError);

  login(payload: LoginPayload): void {
    this.store.dispatch(AuthUiActions.loginStarted());
    this.auth.login(payload).subscribe({
      next: (user) => {
        this.store.dispatch(AuthUiActions.loginSucceeded());
        if (user.mustChangePassword) {
          void this.router.navigate(['/reset-password']);
          return;
        }
        const redirect = this.route.snapshot.queryParamMap.get('redirect') || '/projects';
        void this.router.navigateByUrl(redirect);
      },
      error: (err: unknown) => {
        const message =
          typeof err === 'object' &&
          err &&
          'error' in err &&
          typeof (err as { error?: { message?: string } }).error?.message === 'string'
            ? (err as { error: { message: string } }).error.message
            : 'Login failed';
        this.store.dispatch(AuthUiActions.loginFailed({ message }));
      },
    });
  }
}
```

Provide `authUiFeature` reducer in the remote entry / route providers (`provideStates` / `provideStore` feature registration per NgRx 20 patterns used in shell).

- [ ] **Step 5: Re-run facade test — expect PASS**

```bash
npx nx test remote-auth --watch=false --testPathPattern=login-page.facade
```

- [ ] **Step 6: Move auth feature files into the remote** and wire `SetupPageFacade`, `ResetPasswordPageFacade`, `UsersPageFacade` the same way (UI state in `authUi` or dedicated feature slices; intents call `AuthService`).

Update each page component to `inject(LoginPageFacade)` (etc.) instead of `AuthService` / `Store`.

- [ ] **Step 7: Export routes**

`apps/remote-auth/src/app/auth.routes.ts`:

```ts
import { Routes } from '@angular/router';
import { LoginPageComponent } from './login-page/login-page.component';
import { SetupPageComponent } from './setup-page/setup-page.component';
import { ResetPasswordPageComponent } from './reset-password-page/reset-password-page.component';
import { UsersPageComponent } from './users-page/users-page.component';

export const AUTH_REMOTE_ROUTES: Routes = [
  { path: 'login', component: LoginPageComponent },
  { path: 'setup', component: SetupPageComponent },
  { path: 'reset-password', component: ResetPasswordPageComponent },
  { path: 'users', component: UsersPageComponent },
];
```

Shell loads these via MF (`loadChildren` / `loadRemoteModule` per generator) **or** during local transition:

```ts
loadChildren: () =>
  import('remote-auth/Routes').then((m) => m.AUTH_REMOTE_ROUTES),
```

Keep existing guard placements on shell routes.

- [ ] **Step 8: Register remote in host MF config** (`remote-auth` entry URL for dev).

- [ ] **Step 9: Delete `apps/shell/src/app/features/auth`.**

- [ ] **Step 10: Verify**

```bash
npx nx lint remote-auth
npx nx lint shell
npx nx test remote-auth --watch=false
npx nx serve shell --port 4200
```

Expected: `/login`, `/setup`, `/reset-password`, settings users page work.

- [ ] **Step 11: Commit**

```bash
git add mds-ui/apps/remote-auth mds-ui/apps/shell
git commit -m "$(cat <<'EOF'
feat(ui): extract remote-auth with NgRx facades

Peel auth pages into an MF remote and stop components from talking
to AuthService/Store directly.
EOF
)"
```

---

### Task 3: Extract `remote-projects` (projects + settings shell + spaces)

**Files:**
- Create: `mds-ui/apps/remote-projects/**`
- Move: `apps/shell/src/app/features/projects/**`, `features/settings/**`, `features/spaces/**`
- Modify: shell routes for `/projects`, `/settings/**`
- Test: facade specs for list/create/edit

**Interfaces:**
- Consumes: project/warehouse services (move feature services into remote `core/services` unless already global)
- Produces:
  - `PROJECTS_REMOTE_ROUTES`
  - `ProjectsPageFacade` — list load, navigation intents
  - `ProjectCreatePageFacade` / `ProjectEditPageFacade`
  - `SettingsShellFacade` — if settings shell has state; otherwise thin facade for nav-only
  - `SpacesFacade` if spaces UI remains

- [ ] **Step 1: Generate remote `remote-projects` tagged `type:app`, host=`shell`.**

```bash
npx nx g @nx/angular:remote remote-projects --host=shell --tags=type:app
```

- [ ] **Step 2: Write failing `ProjectsPageFacade` spec**

```ts
import { TestBed } from '@angular/core/testing';
import { provideStore } from '@ngrx/store';
import { of } from 'rxjs';
import { Project } from '@mds-ui/models';
import { ProjectsPageFacade } from './projects-page.facade';
import { projectsFeature } from '../store/projects.reducer';

describe('ProjectsPageFacade', () => {
  it('load() writes projects into the store', () => {
    const sample = [{ projectUuid: 'p1', name: 'Demo' } as Project];
    const projectsService = { list: () => of(sample) };

    TestBed.configureTestingModule({
      providers: [
        provideStore({ [projectsFeature.name]: projectsFeature.reducer }),
        ProjectsPageFacade,
        { provide: 'ProjectsService', useValue: projectsService },
      ],
    });

    // After move, provide the real ProjectsService token from the remote.
    const facade = TestBed.inject(ProjectsPageFacade);
    facade.load();
    expect(facade.projects().length).toBeGreaterThan(0);
    expect(facade.loading()).toBe(false);
  });
});
```

Wire the test to the actual `ProjectsService` class token once the file is moved (replace the `'ProjectsService'` string token).

- [ ] **Step 3: Run — expect FAIL**

```bash
npx nx test remote-projects --watch=false --testPathPattern=projects-page.facade
```

- [ ] **Step 4: Implement `projectsFeature` store + `ProjectsPageFacade` + page wiring.**

```ts
@Injectable()
export class ProjectsPageFacade {
  readonly projects: Signal<Project[]>;
  readonly loading: Signal<boolean>;
  readonly error: Signal<string | null>;
  load(): void;
}
```

Also add `ProjectCreatePageFacade` and `ProjectEditPageFacade` with save/load intents matching current create/edit pages.

- [ ] **Step 5: Move all projects/settings/spaces files; export `PROJECTS_REMOTE_ROUTES` matching previous shell paths under projects/settings.**

- [ ] **Step 6: Point shell `app.routes.ts` at the remote; register MF remote; delete shell copies.**

- [ ] **Step 7: Verify**

```bash
npx nx lint remote-projects
npx nx test remote-projects --watch=false
npx nx serve shell --port 4200
```

- [ ] **Step 8: Commit**

```bash
git add mds-ui/apps/remote-projects mds-ui/apps/shell
git commit -m "$(cat <<'EOF'
feat(ui): extract remote-projects with settings and facades

Move projects, settings shell, and spaces into an MF remote with
NgRx facades for list/create/edit surfaces.
EOF
)"
```

---

### Task 4: Extract `remote-warehouses`

**Files:**
- Create: `mds-ui/apps/remote-warehouses/**`
- Move: `apps/shell/src/app/features/warehouses/**` (if still under shell; else from remote-projects if accidentally nested — warehouses is its own feature folder today)
- After Task 3, warehouses may still be routed under settings but code lives in `features/warehouses` — move that folder here
- Test: `WarehousesPageFacade` spec

**Interfaces:**
- Produces: `WAREHOUSES_REMOTE_ROUTES`, `WarehousesPageFacade`, `WarehouseEditPageFacade`, `WarehouseCreateDialogFacade` (or dialog opened via facade intents)

- [ ] **Step 1: Generate `remote-warehouses` (`type:app`).**

```bash
npx nx g @nx/angular:remote remote-warehouses --host=shell --tags=type:app
```

- [ ] **Step 2: Write failing `WarehousesPageFacade` spec**

```ts
import { TestBed } from '@angular/core/testing';
import { provideStore } from '@ngrx/store';
import { of } from 'rxjs';
import { WarehousesPageFacade } from './warehouses-page.facade';
import { warehousesFeature } from '../store/warehouses.reducer';

describe('WarehousesPageFacade', () => {
  it('load() populates warehouses', () => {
    TestBed.configureTestingModule({
      providers: [
        provideStore({ [warehousesFeature.name]: warehousesFeature.reducer }),
        WarehousesPageFacade,
        { provide: 'WarehouseService', useValue: { list: () => of([]) } },
      ],
    });
    const facade = TestBed.inject(WarehousesPageFacade);
    facade.load();
    expect(facade.loading()).toBe(false);
  });
});
```

Replace `'WarehouseService'` with the real service token after the move.

- [ ] **Step 3: Run test — expect FAIL; implement store + facades; move files; export routes; wire shell settings warehouse children to remote.**

- [ ] **Step 4: Lint/test/serve; commit**

```bash
git add mds-ui/apps/remote-warehouses mds-ui/apps/shell
git commit -m "$(cat <<'EOF'
feat(ui): extract remote-warehouses with facades

Peel warehouse management into an MF remote behind NgRx facades.
EOF
)"
```

---

### Task 5: Extract `remote-tables`

**Files:**
- Create: `mds-ui/apps/remote-tables/**`
- Move: `apps/shell/src/app/features/tables/**`
- Test: `TableHubPageFacade` spec

**Interfaces:**
- Produces: `TABLES_REMOTE_ROUTES`, `TableHubPageFacade` (attributes/links intents), facades for dialogs as needed

- [ ] **Step 1: Generate remote; write failing `TableHubPageFacade` test; implement store/facade; move; wire shell project table routes; verify; commit** `feat(ui): extract remote-tables with facades`

---

### Task 6: Extract `libs/feature-chart-query` (before explorer/charts/dashboards)

**Files:**
- Create: `mds-ui/libs/feature-chart-query/**`
- Move from: `libs/core` chart-query store slice currently under core (`store/chart-query/**`) **if** it still lives in `@mds-ui/core` after foundation — move it out to keep `core` small
- Modify: explorer/charts/dashboards imports to `@mds-ui/feature-chart-query`
- Tags: `type:feature`

**Interfaces:**
- Consumes: `@mds-ui/models`, `@mds-ui/core` (API)
- Produces: chart-query actions/selectors/effects/providers + optional `ChartQueryFacade` for shared consumers

- [ ] **Step 1: Generate** 

```bash
npx nx g @nx/angular:library feature-chart-query --directory=libs/feature-chart-query --standalone --buildable --prefix=mds --tags=type:feature --importPath=@mds-ui/feature-chart-query
```

- [ ] **Step 2: Move chart-query store files; export `provideChartQueryState()` and `ChartQueryFacade`.**

`ChartQueryFacade` surface:

```ts
@Injectable({ providedIn: 'root' })
export class ChartQueryFacade {
  readonly /* selectors as signals used today */;
  invalidateAll(): void;
  // wrap existing ChartQueryActions dispatchers used by explorer/charts/dashboards
}
```

- [ ] **Step 3: Replace direct `Store` + `ChartQueryActions` usage in shell features (or remotes already extracted) with `ChartQueryFacade`.

- [ ] **Step 4: Ensure `@mds-ui/core` no longer exports chart-query; lint boundaries; test; commit** `refactor(ui): move chart-query into type:feature library`

---

### Task 7: Extract `remote-explorer`

**Files:**
- Create: `mds-ui/apps/remote-explorer/**`
- Move: `apps/shell/src/app/features/explorer/**`
- Test: `ExplorerPageFacade`, `TablesWorkspacePageFacade` specs

**Interfaces:**
- Consumes: `@mds-ui/feature-chart-query`, `@mds-ui/models`, `@mds-ui/core`, `@mds-ui/shared`
- Produces: `EXPLORER_REMOTE_ROUTES`, page facades — **components must not inject `Store`**

Facade surfaces:

```ts
@Injectable()
export class ExplorerPageFacade {
  // expose signals/methods currently used by ExplorerPageComponent via Store/services
  load(): void;
}

@Injectable()
export class TablesWorkspacePageFacade {
  runQuery(): void;
  // additional intents currently on TablesWorkspacePageComponent
}
```

- [ ] **Step 1: Generate remote; write failing facade tests; implement stores/facades; move files; wire shell explore routes; remove `Store` from components; verify; commit** `feat(ui): extract remote-explorer with facades`

---

### Task 8: Extract `remote-charts`

**Files:**
- Create: `mds-ui/apps/remote-charts/**`
- Move: `apps/shell/src/app/features/charts/**`
- Test: `ChartsListPageFacade`, `ChartViewPageFacade` specs

**Interfaces:**
- Consumes: `@mds-ui/feature-chart-query`, shared chart field accordion from `@mds-ui/shared`
- Produces: `CHARTS_REMOTE_ROUTES`, list/view facades; echarts helpers stay inside remote

- [ ] **Step 1: Generate remote; failing facade tests; implement; move; wire shell chart routes; verify no component `Store` inject; commit** `feat(ui): extract remote-charts with facades`

---

### Task 9: Extract `remote-dashboards`

**Files:**
- Create: `mds-ui/apps/remote-dashboards/**`
- Move: `apps/shell/src/app/features/dashboards/**`
- Test: `DashboardsListPageFacade`, `DashboardViewPageFacade`, `DashboardEditPageFacade` specs

**Interfaces:**
- Consumes: `@mds-ui/feature-chart-query` for tiles; `@mds-ui/shared` as needed
- Produces: `DASHBOARDS_REMOTE_ROUTES` + facades; `DashboardChartTile` uses facade/query facade not raw `Store`

- [ ] **Step 1: Generate remote; facade tests; implement; move; wire routes; verify; commit** `feat(ui): extract remote-dashboards with facades`

---

### Task 10: Extract `remote-lineage`

**Files:**
- Create: `mds-ui/apps/remote-lineage/**`
- Move: `apps/shell/src/app/features/lineage/**`
- Test: `LineagePageFacade` spec

**Interfaces:**
- Produces: `LINEAGE_REMOTE_ROUTES`, `LineagePageFacade` wrapping `LineageService` + UI selection state in store

- [ ] **Step 1: Generate remote; failing `LineagePageFacade` test; implement store/facade; move; wire `/lineage` routes; verify; commit** `feat(ui): extract remote-lineage with facades`

---

### Task 11: Extract `remote-ai`

**Files:**
- Create: `mds-ui/apps/remote-ai/**`
- Move: `apps/shell/src/app/features/ai/**`
- Test: `AiAssistantPanelFacade` spec

**Interfaces:**
- Produces: remote entry exporting AI panel component + `AiAssistantPanelFacade`; shell/layout opens panel via remote module load or shared launcher in shell that `loadRemoteModule`s the panel

- [ ] **Step 1: Generate remote; facade test; implement; move; wire shell integration point (navbar/shell) without remote→remote imports; verify; commit** `feat(ui): extract remote-ai with facades`

---

### Task 12: Extract `remote-export`

**Files:**
- Create: `mds-ui/apps/remote-export/**`
- Move: `apps/shell/src/app/features/export/**`
- Test: `ExportDialogFacade` / `ExportService` wrapper facade spec

**Interfaces:**
- Produces: public `openExportDialog(...)` entry used by shell via MF lazy import or a tiny `@mds-ui/feature-export-api` `type:feature` lib that only declares the dialog opener token — **prefer** feature lib with dialog component moved into remote and opener in feature lib only if MF dialog open is awkward; default: shell `loadRemoteModule('remote-export/Opener')`.

Locked default:

```ts
// remote-export public API
export { ExportDialogComponent } from './export-dialog.component';
export class ExportDialogFacade {
  startExport(/* args used by start-export.ts */): void;
}
```

- [ ] **Step 1: Generate remote; failing facade test around `startExport`; implement; move; update charts/dashboards callers to use public opener (through shell-mediated import or `type:feature` API lib — no remote→remote); verify; commit** `feat(ui): extract remote-export with facades`

---

### Task 13: Cleanup, CI, documentation

**Files:**
- Delete: any remaining `apps/shell/src/app/features/**` empties
- Modify: `mds-ui/README.md`, CI workflow if present under `mds-ui` or repo `deploy/`
- Modify: `package.json` scripts for `nx serve shell` / `nx run-many -t build`

**Interfaces:**
- Produces: documented remotes list; CI builds all apps

- [ ] **Step 1: Assert no leftover feature tree**

```bash
if [ -d apps/shell/src/app/features ] && [ -n "$(find apps/shell/src/app/features -type f -name '*.ts' 2>/dev/null)" ]; then
  echo 'FAIL: leftover feature sources in shell' >&2
  exit 1
fi
echo 'shell features cleared OK'
```

- [ ] **Step 2: Grep for forbidden patterns**

```bash
# Components in remotes must not inject Store directly
rg "inject\(Store\)" apps/remote-*/src -g '*.component.ts' && exit 1 || true
# No remote importing another remote path
rg "from 'remote-" apps/remote-*/src && exit 1 || true
```

Expected: no matches.

- [ ] **Step 3: Full build**

```bash
npx nx run-many -t lint,test,build --all --watch=false
```

Expected: PASS.

- [ ] **Step 4: Update README** with apps/libs diagram, serve instructions (host + remotes), and pointer to architecture spec.

- [ ] **Step 5: Commit** `docs(ui): finalize Nx MF remotes layout and CI scripts`

---

## Self-review (author)

| Spec requirement | Task |
|------------------|---|
| MF remotes per feature | Tasks 2–5, 7–12 |
| Shell owns routing | Task 1 + each remote wire step |
| Store + facade every feature | Each remote task |
| No remote→remote | Task 12 + Task 13 grep |
| chart-query not bloating core | Task 6 |
| Always shippable | verify steps each task |
| Tailwind/Material unchanged | inherited from foundation |

**Remote peel cycle (normative for Tasks 4–5, 7–12):** For each remaining remote, execute this exact cycle using that task’s facade names and source folders — do not skip facade tests:

1. `npx nx g @nx/angular:remote <name> --host=shell --tags=type:app`
2. Add `<Facade>.spec.ts` that fails (missing facade)
3. `npx nx test <name> --watch=false` → FAIL
4. Add feature store + facades; move sources from `apps/shell/src/app/features/<folder>`; export `<NAME>_REMOTE_ROUTES`
5. Register MF remote; point shell routes at remote; delete shell copies
6. Replace component `inject(Store)` / direct feature service UI orchestration with facades
7. `npx nx lint <name> && npx nx test <name> --watch=false && npx nx serve shell`
8. Commit with the message given in that task

Placeholder scan: no TBD. Users-page ownership locked to `remote-auth`. Export integration locked to shell-mediated / feature-api opener (no remote→remote).

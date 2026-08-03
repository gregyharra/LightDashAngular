# CASL UI abilities

**Date:** 2026-08-03  
**Status:** Draft — awaiting user review  
**Related:** [SSO / OIDC](./2026-08-03-sso-oidc-design.md), [ACL / OpenFGA + OPA](./2026-08-03-acl-openfga-opa-design.md)

## Problem

The Angular app already receives stub `abilityRules` on `UserProfile`, but authorization in the UI is mostly `AppStateService.isAdmin()` and route `adminGuard`. That will not scale to per-project ACL and will drift from OpenFGA + OPA decisions on the server.

We need **CASL** (`@casl/angular`) as the UI permission helper, fed only by server-compiled rules.

## Goals

1. Wire `@casl/angular` so templates and guards use `can(action, subject)` instead of scattered `role === 'admin'` checks.
2. Treat `abilityRules` from `GET /user` (and later project-scoped endpoints) as the **only** client-side permission input.
3. Keep CASL **non-authoritative**: hiding UI never replaces backend `authorize()`.
4. Support SSO-only UI (hide password management when `authMode === sso`).
5. Migrate gradually from `isAdmin()` without a big-bang rewrite.

## Non-goals

- Implementing OpenFGA or OPA in the browser
- Storing abilities in `localStorage` as a security boundary
- Full Lightdash CASL subject parity on day one
- Custom role editor UI

## Shared authorization plane (UI slice)

```
OpenFGA + OPA → backend compiles abilityRules → GET /user
                                              → AppState / Ability service
                                              → @casl/angular in templates & guards
```

The browser never talks to OpenFGA or OPA directly.

## Ability rule shape

Compatible with existing payload and Lightdash-style CASL JSON:

```ts
type AbilityRule = {
  action: string | string[];
  subject: string | string[];
  /** Optional CASL conditions, e.g. { projectUuid: '...' } */
  conditions?: Record<string, unknown>;
  inverted?: boolean;
};
```

### v1 subjects / actions (aligned with ACL spec)

| Subject | Actions (examples) | Meaning |
|---------|-------------------|---------|
| `all` | `manage` | Workspace superuser (workspace FGA admin) |
| `Project` | `view`, `manage` | Per-project; use `conditions.projectUuid` when scoped |
| `Warehouse` | `manage` | Workspace warehouses settings |
| `User` | `manage` | User admin page |
| `ExportCsv` | `manage` | Keep today’s member export affordance if still desired |

Backend compiler maps FGA relations + OPA allows into these rules. During dual-run, compiler may still derive from `users.role` until FGA is authoritative.

## Angular integration

1. Add `@casl/ability` + `@casl/angular`.  
2. Provide an `Ability` (or `PureAbility`) updated whenever `AppStateService` refreshes the user.  
3. Prefer signal-friendly wrappers if needed (thin service that rebuilds Ability from `user()?.abilityRules`).  
4. Templates: `*ngxCan` / injectable `AbilityService` (follow current `@casl/angular` API for the locked package version).  
5. Replace checks incrementally:

| Today | Target |
|-------|--------|
| `appState.isAdmin()` | `can('manage', 'User')` / `can('manage', 'Warehouse')` / `can('manage', 'all')` |
| `adminGuard` | Guard that requires a specific ability (e.g. `manage` `Warehouse`) |
| Project create/edit buttons | `can('manage', subject('Project', { projectUuid }))` or workspace-level create rule |

Keep `isAdmin()` as a deprecated computed during migration (`role === 'admin' || can('manage','all')`) then remove.

## SSO-aware UI

When health reports `authMode === 'sso'` (or `ssoEnabled`):

- Hide Change password  
- Hide any “temporary password” copy that implies password login (admin provisioning UX may still show “user must sign in via SSO”)  
- Login page: SSO CTA only  

These are presentation flags from health/config, not CASL subjects (unless we add `can('manage', 'Password')` inverted by the server — prefer explicit `authMode` for clarity).

## Project-scoped abilities (v1.1 stretch)

If `GET /user` global rules become large, add:

`GET /projects/{uuid}/abilities` → rules for the current project context.

Explorer/dashboard routes load that after project selection. Not required for first CASL wiring if global rules with conditions suffice.

## Error / empty states

- No rules / empty user → Ability denies all; guards send to `/projects` or `/login`.  
- Stale abilities after grant/revoke → refresh user on navigation to settings or after admin membership API success.  
- 403 from API → show existing error handling; do not invent client-side overrides.

## Testing

- Unit: Ability built from sample `abilityRules`; `can` expectations.  
- Component: projects management buttons hidden without `manage` Project.  
- Guard: member cannot activate `/settings/warehouses`.  
- No test should assume CASL blocks API access (pair with backend authz tests).

## Migration plan (UI)

1. Add CASL provider fed by existing stub `abilityRules`.  
2. Switch settings nav + warehouses/users guards to abilities.  
3. Switch project management buttons to abilities with conditions once ACL API exists.  
4. Remove `isAdmin()` usages.  
5. When SSO ships, bind password UI to `authMode`.

## Out of scope / later

- Impersonation abilities  
- Embed viewer abilities  
- Field-level UI disabling inside chart builders beyond subject-level checks

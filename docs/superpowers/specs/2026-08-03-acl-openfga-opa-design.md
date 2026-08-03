# ACL / jurisdiction (OpenFGA + OPA)

**Date:** 2026-08-03  
**Status:** Draft — awaiting user review  
**Related:** [SSO / OIDC](./2026-08-03-sso-oidc-design.md), [CASL UI](./2026-08-03-casl-ui-design.md)

## Problem

Auth v1 uses two coarse roles (`admin` / `member`) and `require_admin` on mutations. Every authenticated user can see all projects. Real deployments need **per-project access** and a path to richer jurisdiction rules without rewriting auth every time.

We will use **OpenFGA** for relationship-based access and **OPA** for policy/jurisdiction on top of those relationships. The API is the only enforcer; the UI mirrors decisions via CASL (separate spec).

## Goals

1. Introduce an authorization plane: OpenFGA (relationships) → OPA (policy) → allow/deny.
2. **v1 ACL scope:** project membership (who can view/use/manage which projects) plus workspace-level admin for settings/users/warehouses.
3. Design the FGA model so **spaces, dashboards, charts, warehouses** can be added later without a rewrite.
4. Replace ad-hoc `require_admin` gradually with a single `authorize(action, resource)` path.
5. Migrate existing deployments so current behavior does not break until ACLs are curated (seed tuples).

## Non-goals

- Per-row / column-level data policies inside warehouse queries (future; may use OPA later)
- Full Lightdash org + custom role UI parity in v1
- Making CASL authoritative
- Implementing SSO (see SSO spec); FGA may later consume IdP groups once provisioning is chosen
- Multi-tenant “organization” reintroduction beyond a single workspace type in FGA

## Shared authorization plane

```
Request → resolve User (session)
       → OpenFGA check / list (relationships)
       → OPA evaluate (policy + jurisdiction + FGA result + context)
       → allow | deny
```

| Component | Owns |
|-----------|------|
| **OpenFGA** | “User U is `viewer`/`editor`/`admin` on project P”; workspace `admin` |
| **OPA** | Deny overrides, jurisdiction tags, env constraints, “even if FGA allows, policy forbids” |
| **mds-backend** | Calls both; returns 403; compiles `abilityRules` for the UI |
| **CASL** | Hide/disable controls only |

## OpenFGA model (v1)

### Types (initial)

- `user`
- `workspace` — single workspace object per deployment (id stable, e.g. `workspace:default`)
- `project`

Reserved for later (define in schema comments / unused relations ok): `space`, `dashboard`, `saved_chart`, `warehouse`.

### Relations (v1)

**workspace**

- `admin` — users who manage users, warehouses, workspace settings (maps today’s `role=admin`)

**project**

- `viewer` — can open project, dashboards, explores, lineage (read paths)
- `editor` — viewer + create/edit charts/dashboards (when those mutations exist)
- `admin` — editor + project settings, git sync, delete (maps today’s project mutations)

Use FGA userset rewriting so `admin` implies `editor` implies `viewer`.

### Example tuples

```
workspace:default#admin@user:<adminUuid>
project:<projectUuid>#viewer@user:<memberUuid>
project:<projectUuid>#admin@user:<creatorUuid>
```

### Write paths (who mutates FGA)

| Event | Tuples |
|-------|--------|
| Workspace admin promoted/demoted | `workspace#admin` |
| Project created | creator → `project#admin` |
| Admin assigns project access (future UI) | add/remove `viewer`/`editor`/`admin` |
| User deactivated | delete all tuples for that user (or rely on `is_active` check before FGA) |

v1 may keep assigning access via API/admin UI minimal surface: e.g. “grant user access to project” on users or project settings — exact UX in implementation plan.

## OPA policy layer

### Input (illustrative)

```json
{
  "user": { "id": "...", "workspace_role": "admin|member", "claims": {} },
  "action": "view|edit|manage",
  "resource": { "type": "project|warehouse|user|workspace", "id": "..." },
  "fga": { "allowed": true, "relation": "viewer" },
  "context": {
    "environment": "production",
    "jurisdiction": "EU",
    "resource_tags": { "jurisdiction": "EU" }
  }
}
```

### Responsibilities

OPA **must not** re-implement the full relationship graph; it consumes FGA’s answer and applies:

- Jurisdiction: deny if user’s allowed jurisdictions don’t intersect resource tags
- Environment locks (e.g. deny destructive actions in prod without break-glass)
- Global denies (maintenance mode, feature flags)
- Optional: map coarse `workspace_role` into default allows when FGA is empty during migration

Default stance: **deny** unless OPA explicitly allows.

### Deployment

- OPA as sidecar or central service; backend uses HTTP/SDK (`POST /v1/data/...` or Rego via library). Prefer sidecar for latency in k8s.
- Policy bundles versioned in repo (e.g. `mds-backend/authz/opa/`); promotion via normal deploy.

## Backend enforcement

### `authorize(user, action, resource) -> None | raise 403`

1. If user inactive → 401/403  
2. OpenFGA `Check` for the relation implied by `action` + `resource.type`  
3. Build OPA input; evaluate  
4. Deny → `HTTPException(403)`

### Mapping today’s endpoints (v1)

| Area | Today | Target |
|------|-------|--------|
| List projects | Any authenticated | Filter to projects where FGA `viewer` (or stronger) |
| Get project / spaces / lineage / explores | Authenticated | Require `viewer` on that project + OPA |
| Create/update/delete project, git sync | `require_admin` | Project `admin` **or** workspace `admin` (product choice: start with workspace admin **or** project admin — prefer project `admin` for project mutations, workspace `admin` for create-in-workspace) |
| Warehouses CRUD | `require_admin` | Workspace `admin` |
| Users CRUD | `require_admin` | Workspace `admin` |

**Recommended v1 product rule:**  
- Workspace `admin` → manage users, warehouses, create projects, grant ACLs  
- Project `admin` → manage that project’s settings/sync  
- Project `viewer`/`editor` → use the project  

### List/filter

Use OpenFGA **ListObjects** (`project` objects where user has `viewer`) when available; alternatively maintain a read-through cache table synced from FGA writes. Prefer ListObjects first; add cache only if latency requires it.

## Migration from current roles

On enabling FGA for an existing DB:

1. Ensure `workspace:default` exists.  
2. Every user with `role=admin` → `workspace:default#admin@user:<uuid>`.  
3. Every project × every user → `project:<id>#viewer@user:<uuid>` **or** (stricter) only admins get `project#admin` and members get `viewer` on all projects — **default recommendation:** preserve today’s “everyone sees everything”: all active users get `viewer` on all projects; workspace admins also get `admin` on all projects.  
4. Stop treating `users.role` as the sole gate once FGA is authoritative; keep `role` as a denormalized label / bootstrap hint until UI catches up.

Dual-run period: `authorize()` may allow if **either** legacy `require_admin` **or** FGA+OPA allows, behind a flag `AUTHZ_ENFORCE=legacy|dual|fga` — cut over to `fga` after verification.

## API / product surface (v1 minimal)

- Internal: FGA client + OPA client modules under `mds.services.authz`.  
- Admin API (minimal): grant/revoke project membership (`POST/DELETE /projects/{uuid}/members` or under `/users/{uuid}/projects`).  
- `GET /user` ability compilation: see CASL spec (backend still owns the compiler here).

## Error handling

- FGA/OPA unavailable → fail closed in production (503 or 403 with “authorization unavailable”); optional fail-open only in local `AUTHZ_ENFORCE=legacy`.  
- Audit log (structured): user, action, resource, fga result, opa result, decision id.

## Testing

- FGA model tests (relationship rewriting).  
- OPA unit tests (Rego) for jurisdiction deny/allow.  
- API tests: member without project tuple cannot GET project; with `viewer` can; warehouse POST requires workspace admin.  
- Migration seed idempotency.

## Extensibility (later, designed-in)

Add types/relations for `space`, `dashboard`, `warehouse` without changing the `authorize()` shape. OPA gains new `resource.type` branches. IdP group sync writes FGA tuples (SSO provisioning A3).

## Out of scope / later

- Custom role builder UI  
- Embed/anonymous tokens  
- Service accounts / PATs (can be FGA subjects later)

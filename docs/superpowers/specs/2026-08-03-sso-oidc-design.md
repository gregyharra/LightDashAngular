# SSO / OIDC (generic, SSO-only when enabled)

**Date:** 2026-08-03  
**Updated:** 2026-09-08  
**Status:** Accepted  
**Related:** [ACL / OpenFGA + OPA](./2026-08-03-acl-openfga-opa-design.md), [CASL UI](./2026-08-03-casl-ui-design.md)  
**Plan:** [2026-09-08-sso-oidc-login.md](../plans/2026-09-08-sso-oidc-login.md)

## Problem

MDS auth today is local email/password with cookie sessions. Companies will require their own IdP (e.g. MyIAM federating eLDAP). We need a **generic OIDC** integration that can be turned on per deployment. When SSO is enabled, local password auth must be unavailable so policy is unambiguous.

## Goals

1. Support **generic OIDC** (Authorization Code + PKCE) configurable via env — no IdP-specific code paths in v1.
2. When SSO is enabled, the product is **SSO-only** (no password login, setup, or password-reset UX for normal sign-in).
3. After OIDC success, mint the **same** `mds_session` cookie used today so the rest of the app is unchanged.
4. Expose auth mode to the UI via health/bootstrap so login and users screens render correctly.
5. **IdP-authoritative access:** MyIAM / eLDAP group membership gates platform access and MDS role; the platform never mutates group membership.

## Non-goals

- SAML
- SCIM / IdP-driven user lifecycle sync from MDS
- Editing roles or groups from the MDS UI/API when `AUTH_MODE=sso`
- Multiple simultaneous IdPs
- Social login as a product feature (Google/Okta only matter as OIDC issuers)
- Replacing OpenFGA/OPA (identity only; authorization is separate — see related specs)
- SMTP / magic links
- Mid-session continuous group re-check (role/access refresh on next SSO login / new session)

## Shared authorization plane (context)

```
Browser → mds-ui → mds-backend
                    ├─ OIDC IdP (MyIAM ← eLDAP)  (AuthN + platform allow-list — this spec)
                    ├─ OpenFGA                   (relationships — ACL spec)
                    ├─ OPA                       (policy / jurisdiction — ACL spec)
                    └─ abilityRules → CASL       (UI only — CASL spec)
```

SSO answers **who** the principal is and whether they may enter the platform (`admin` vs `member`). It does not grant per-project access; that remains OpenFGA + OPA.

## Mode switch

| Setting | Values | Behavior |
|---------|--------|----------|
| `AUTH_MODE` | `local` (default) \| `sso` | Selects auth surface |

When `AUTH_MODE=sso`:

| Capability | Behavior |
|------------|----------|
| Login UI | SSO button only — no email/password fields |
| `POST /login`, `POST /setup` (password) | Disabled (403) |
| Change password / admin temp-password / password reset for sign-in | Disabled |
| Create user / PATCH role from users admin UI | Disabled — IdP owns membership and role |
| Users list | Read-only display of known users (optional deactivate remains a later decision) |
| Local `/setup` | Skipped — `isSetupComplete` is treated as complete for routing; first admin arrives via admin group SSO |
| Session cookie | Still `mds_session` after OIDC callback |
| `GET /health` | Includes `authMode: "sso"`, `ssoEnabled: true`, and `auth.disablePasswordAuthentication: true` |

When `AUTH_MODE=local`, behavior remains as shipped today.

## Locked decisions

### A. Provisioning — A3 claims/groups (two groups)

MyIAM exposes eLDAP groups in the OIDC token (or userinfo). MDS maps two configured group values:

| Group (env) | Outcome |
|-------------|---------|
| `OIDC_ADMIN_GROUP` | Sign-in allowed → local `User.role = admin` |
| `OIDC_MEMBER_GROUP` | Sign-in allowed → local `User.role = member` |
| Neither | Deny → `/login?error=not_provisioned` |
| Both | **Admin wins** |

On **every** successful SSO login:

1. Resolve user by `(oidc_issuer, oidc_sub)`, else by verified email if needed for linking, else JIT-create.
2. Sync `role` from current group membership (IdP is source of truth).
3. Update display fields (name/email) from claims when present.
4. Mint session.

Group membership is **never** editable from MDS. Admins manage access only in MyIAM / eLDAP.

### B. Bootstrap — B2 first allowlisted SSO admin

- No local password setup when `AUTH_MODE=sso`.
- First (and subsequent) successful logins from the **admin** group create/update workspace admins.
- Member-group users can sign in once the deployment is running; they do not become admin.
- Optional later: break-glass CLI local admin for IdP outages (**B3**) — not required for v1.

## OIDC flow

1. User opens `/login` → UI navigates to `GET /api/v1/auth/oidc/login` (optional `redirect` query).
2. Backend redirects to IdP authorize endpoint (PKCE `code_challenge`, `state` + nonce bound server-side).
3. IdP redirects to `GET /api/v1/auth/oidc/callback?code=&state=`.
4. Backend exchanges code, validates ID token (issuer, audience, signature, nonce), reads claims + groups.
5. Map groups → allow/deny + role; upsert local `User`.
6. `create_session` + set `mds_session` cookie; redirect to app (`redirect` or `/projects`).
7. Logout: delete MDS session + clear cookie; optionally call IdP end-session URL if configured.

### Required config (env)

- `AUTH_MODE=sso`
- `OIDC_ISSUER` (discovery base / issuer URL)
- `OIDC_CLIENT_ID`
- `OIDC_CLIENT_SECRET` (confidential client)
- `OIDC_REDIRECT_URI` (typically `{API_PUBLIC_URL}/api/v1/auth/oidc/callback`)
- `OIDC_SCOPES` (default `openid email profile`; add groups scope if MyIAM requires it)
- `OIDC_GROUPS_CLAIM` (default `groups`)
- `OIDC_ADMIN_GROUP` — exact string match against a groups claim value
- `OIDC_MEMBER_GROUP` — exact string match against a groups claim value
- Optional: `OIDC_END_SESSION_URL`, `OIDC_EMAIL_CLAIM`, `OIDC_EMAIL_VERIFIED_CLAIM`

`PUBLIC_APP_URL` / `APP_ORIGIN` remain the browser origin for post-login redirects.

In `AUTH_MODE=sso`, missing required OIDC settings → **fail fast at startup** (or mark unhealthy); do not silently fall back to password auth.

## Identity linking

- Store `oidc_issuer` + `oidc_sub` on `users`.
- Keep normalized `email` for display.
- Unique constraint on `(oidc_issuer, oidc_sub)` where both non-null.
- Fail closed if email claim is missing, or if the IdP marks email unverified when a verified claim is present.
- `password_hash` may be empty for SSO-only users; password verification paths stay disabled in SSO mode.
- `auth_provider`: `local` \| `oidc`.

## API surface (delta)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/v1/auth/oidc/login` | Start authorize redirect |
| GET | `/api/v1/auth/oidc/callback` | Finish login, set cookie |
| GET | `/api/v1/health` | Add `authMode` / `ssoEnabled` / password-disabled flag |
| POST | `/login`, `/setup`, password endpoints | 403 when `AUTH_MODE=sso` |
| POST | `/users`, PATCH role / password-reset admin | 403 when `AUTH_MODE=sso` |

Logout stays `POST /logout`; IdP RP-initiated logout is optional later.

## Error handling

- Invalid/expired `state` or token → `/login?error=sso_failed` (generic message; no token leakage).
- Not in admin or member group → `/login?error=not_provisioned`.
- Disabled user (`is_active=false`) → deny after successful IdP auth.
- Misconfigured OIDC in `sso` mode → fail-fast / unhealthy.

## UI implications

- Login: SSO CTA only when `authMode === 'sso'`; surface `error` query params.
- Guards: when SSO, never force `/setup` for empty user table (`isSetupComplete` true or equivalent).
- Users page (SSO): list only; hide create user, role edit, temp password / reset password.
- Hide change-password entry points when SSO.

## Testing

- Unit: PKCE/state, group→role mapping (admin wins, neither denies), mode gates on password and user-mutation routes.
- Integration: mock IdP discovery + token endpoints; assert session cookie, user upsert, role sync on second login.
- UI: login switches on `authMode`; users page hides mutation controls when SSO.

## Out of scope / later

- Group → OpenFGA tuple sync (ACL workstream)
- Break-glass local admin CLI (B3)
- Device / native apps
- Step-up MFA beyond what the IdP already enforces
- Soft-deactivate users removed from groups without waiting for next login

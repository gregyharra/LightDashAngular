# SSO / OIDC (generic, SSO-only when enabled)

**Date:** 2026-08-03  
**Status:** Draft — awaiting user review  
**Related:** [ACL / OpenFGA + OPA](./2026-08-03-acl-openfga-opa-design.md), [CASL UI](./2026-08-03-casl-ui-design.md)

## Problem

MDS auth today is local email/password with cookie sessions (`feature/auth-login-setup`). Companies will require their own IdP. We need a **generic OIDC** integration that can be turned on per deployment. When SSO is enabled, local password auth must be unavailable so policy is unambiguous.

## Goals

1. Support **generic OIDC** (Authorization Code + PKCE) configurable via env — no IdP-specific code paths in v1.
2. When SSO is enabled, the product is **SSO-only** (no password login, setup, or password-reset UX for normal sign-in).
3. After OIDC success, mint the **same** `mds_session` cookie used today so the rest of the app is unchanged.
4. Expose auth mode to the UI via health/bootstrap so login renders correctly.
5. Document open decisions for **user provisioning** and **first-admin bootstrap** without locking them in this iteration.

## Non-goals

- SAML
- SCIM / IdP-driven user lifecycle sync (may inform provisioning later)
- Multiple simultaneous IdPs
- Social login as a product feature (Google/Okta only matter as OIDC issuers)
- Replacing OpenFGA/OPA (identity only; authorization is separate — see related specs)
- SMTP / magic links

## Shared authorization plane (context)

```
Browser → mds-ui → mds-backend
                    ├─ OIDC IdP          (AuthN — this spec)
                    ├─ OpenFGA           (relationships — ACL spec)
                    ├─ OPA               (policy / jurisdiction — ACL spec)
                    └─ abilityRules → CASL (UI only — CASL spec)
```

SSO answers **who** the principal is. It does not grant project access; that remains OpenFGA + OPA.

## Mode switch

Config (names illustrative):

| Setting | Values | Behavior |
|---------|--------|----------|
| `AUTH_MODE` | `local` (default) \| `sso` | Selects auth surface |

When `AUTH_MODE=sso`:

| Capability | Behavior |
|------------|----------|
| Login UI | SSO button only — no email/password fields |
| `POST /login`, `POST /setup` (password) | Disabled (403 or 404) |
| Change password / admin temp-password / password reset for sign-in | Disabled |
| Password reset CLI as a *login* path | Disabled for normal ops; break-glass admin may remain an open decision |
| Session cookie | Still `mds_session` after OIDC callback |
| `GET /health` | Includes `authMode: "sso"` / `ssoEnabled: true` |

When `AUTH_MODE=local`, behavior remains as shipped on `feature/auth-login-setup`.

## OIDC flow

1. User opens `/login` → UI calls or navigates to `GET /api/v1/auth/oidc/login` (optional `redirect` query).
2. Backend redirects to IdP authorize endpoint (PKCE `code_challenge`, `state` bound to server-side nonce store or signed cookie).
3. IdP redirects to `GET /api/v1/auth/oidc/callback?code=&state=`.
4. Backend exchanges code, validates ID token (issuer, audience, signature, nonce), reads claims.
5. Resolve or create local `User` per provisioning policy (open decision).
6. `create_session` + set `mds_session` cookie; redirect to app (`redirect` or `/projects`).
7. Logout: delete MDS session + clear cookie; optionally call IdP end-session URL if configured.

### Required config (env)

- `OIDC_ISSUER` / discovery URL  
- `OIDC_CLIENT_ID`  
- `OIDC_CLIENT_SECRET` (confidential client; public+PKCE-only is a later option)  
- `OIDC_REDIRECT_URI` (must match IdP registration; typically `{API_PUBLIC_URL}/api/v1/auth/oidc/callback`)  
- `OIDC_SCOPES` (default `openid email profile`)  
- Optional: `OIDC_END_SESSION_URL`, claim name overrides (`OIDC_EMAIL_CLAIM`, etc.)

`PUBLIC_APP_URL` / `APP_ORIGIN` remain the browser origin for post-login redirects.

## Identity linking

- Prefer stable link: store `oidc_issuer` + `oidc_sub` on `users` (new columns).
- Also keep normalized `email` for display and for provisioning strategies that match on email.
- Fail closed if email claim is missing or (when IdP provides it) email is not verified — exact rule may depend on the chosen provisioning option.

## Open decisions (not locked)

### A. User provisioning on first SSO login

| Option | Behavior |
|--------|----------|
| **A1 JIT** | First successful OIDC login creates a `User` with a default role (e.g. `member`) |
| **A2 Pre-create** | Admin must create the user first; email (or sub) must match or login is rejected |
| **A3 Claims/groups** | IdP groups/roles claims decide allow-list and/or default MDS role |

Pick before implementation planning for SSO.

### B. First admin / bootstrap when SSO will be used

| Option | Behavior |
|--------|----------|
| **B1 Setup-until-SSO** | Keep local `/setup` until SSO is enabled; then password paths off |
| **B2 First allowlisted SSO user** | No local setup; first login matching an allowlisted group/email becomes workspace admin |
| **B3 Break-glass** | Env/CLI local admin always exists for recovery even when `AUTH_MODE=sso` |

## Data model (delta)

On `users` (lightweight migration as elsewhere):

| Column | Purpose |
|--------|---------|
| `oidc_issuer` | Issuer URL (nullable for local-only users) |
| `oidc_sub` | Subject from IdP (nullable) |
| `auth_provider` | `local` \| `oidc` (optional convenience) |

Unique constraint on `(oidc_issuer, oidc_sub)` where both non-null.

Password hash may remain null for SSO-only users.

## API surface (delta)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/v1/auth/oidc/login` | Start authorize redirect |
| GET | `/api/v1/auth/oidc/callback` | Finish login, set cookie |
| GET | `/api/v1/health` | Add `authMode` / `ssoEnabled` |
| POST | `/login`, `/setup`, password endpoints | Reject when `AUTH_MODE=sso` |

Logout stays `POST /logout`; extend later for IdP RP-initiated logout.

## Error handling

- Invalid/expired `state` or token → redirect to `/login?error=sso_failed` with generic message (no token leakage).
- Unknown user under pre-create policy → `/login?error=not_provisioned`.
- Disabled user (`is_active=false`) → deny after successful IdP auth.
- Misconfigured OIDC at startup → log clearly; health can report `ssoConfigured: false` without crashing the whole API if local mode is still viable (in `sso` mode, fail startup or mark unhealthy — prefer fail-fast in production).

## Testing

- Unit: state/PKCE, claim parsing, mode gates on password routes.
- Integration: mock IdP (or recorded discovery + token endpoints); assert session cookie and user linking.
- UI: login page switches on `authMode`; password UI hidden when SSO-only.

## Out of scope / later

- Group → OpenFGA tuple sync (belongs with ACL once provisioning A3 is chosen)
- Device / native apps
- Step-up MFA beyond what the IdP already enforces

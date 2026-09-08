# SSO / OIDC Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Execute task-by-task.

**Goal:** Enable generic OIDC login (MyIAM / any IdP) with two eLDAP groups controlling platform access (`admin` vs `member`), SSO-only mode when configured, and the same `mds_session` cookie as today.

**Architecture:** Backend owns OIDC Authorization Code + PKCE, group→role mapping, and session minting. Frontend reads `authMode` from health and shows SSO-only login / read-only users UI. Group membership is IdP-authoritative — MDS never mutates groups or SSO roles.

**Tech stack:** FastAPI (`mds-backend`), SQLAlchemy lightweight schema upgrades, `httpx` + `PyJWT`/`joserfc` (or equivalent) for OIDC, Angular (`mds-ui`) health bootstrap + login/users pages.

**Spec:** [2026-08-03-sso-oidc-design.md](../specs/2026-08-03-sso-oidc-design.md)

## Global Constraints

- Work on branch `feat/sso-login`.
- Locked decisions: **A3** two groups (`OIDC_ADMIN_GROUP` / `OIDC_MEMBER_GROUP`, admin wins); **B2** no local setup when SSO — first admin-group login bootstraps; IdP owns membership (no role/group edits from platform in SSO mode).
- Reuse existing `create_session` / `mds_session` cookie; do not invent a second session mechanism.
- `AUTH_MODE=local` (default) must keep current password flows unchanged.
- In `AUTH_MODE=sso`, fail fast if required OIDC env is missing — never silently enable password login.
- Chromium + Firefox; reuse shared UI patterns; i18n keys in `en.json` + `fr.json`.
- Commit after each task; no secrets in repo; do not commit `.tmp/` or `out-tsc/`.

## File structure (locked)

| Path | Responsibility |
|------|----------------|
| `mds-backend/src/mds/config.py` | `AUTH_MODE`, `OIDC_*` settings |
| `mds-backend/src/mds/db/models.py` | User OIDC columns |
| `mds-backend/src/mds/db/session.py` | Lightweight `ALTER` for new columns + unique index |
| `mds-backend/src/mds/services/auth/oidc.py` | Discovery, PKCE, state store, token exchange, claim/group mapping |
| `mds-backend/src/mds/routers/oidc.py` (or extend `auth.py`) | Same router mounted at `/api/auth` and `/api/v1/auth`: `GET /login`, `GET /callback` |
| `mds-backend/src/mds/routers/auth.py` | Gate password + user mutation routes when SSO |
| `mds-backend/src/mds/routers/platform.py` | Health `authMode` / `ssoEnabled` / `disablePasswordAuthentication` |
| `mds-backend/tests/test_oidc*.py` | Unit + integration with mocked IdP |
| `mds-ui/.../api.types.ts` + `app-state.service.ts` | Consume auth mode from health |
| `mds-ui/.../login-page/*` | SSO CTA + error query params |
| `mds-ui/.../users-page/*` | Hide create / role edit / password actions when SSO |
| `mds-ui/.../auth.guard.ts` | Skip `/setup` when SSO |
| `mds-backend/README.md` + `.env.example` if present | Document env vars |

---

### Task 1: Config + health auth mode surface

**Files:**
- Modify: `mds-backend/src/mds/config.py`
- Modify: `mds-backend/src/mds/routers/platform.py`
- Modify: `mds-backend/tests/` (health assertions)
- Modify: `mds-ui/src/app/core/api/api.types.ts`
- Modify: `mds-ui/src/app/core/services/app-state.service.ts` (+ spec if present)
- Modify: `mds-ui/src/app/core/mock/fixtures/index.fixture.ts`

**Steps:**
1. Add settings: `auth_mode: Literal["local","sso"] = "local"`, plus OIDC fields listed in the spec (issuer, client id/secret, redirect URI, scopes, groups claim, admin/member group strings, optional claim overrides / end-session URL).
2. Helper `settings.is_sso` / validate required OIDC fields when `auth_mode == "sso"` at startup (lifespan or settings validator).
3. Extend `GET /health` payload:
   - Top-level or nested: `authMode`, `ssoEnabled` (`auth_mode == "sso"`)
   - `auth.disablePasswordAuthentication: true` when SSO
   - When SSO: `isSetupComplete: true` always (setup not used)
4. Frontend: type health; expose `authMode` / `ssoEnabled` / `passwordAuthDisabled` signals from `AppStateService`.
5. Mock fixture: set `authMode: 'local'` by default; keep existing `auth.oidc` stub consistent or align to new fields.
6. Tests: health local vs sso shapes.

**Commit:** `feat(auth): expose AUTH_MODE and SSO flags on health`

---

### Task 2: User model — OIDC link columns

**Files:**
- Modify: `mds-backend/src/mds/db/models.py`
- Modify: `mds-backend/src/mds/db/session.py` (ensure_* column upgrades)
- Modify: `mds-backend/src/mds/schemas/auth.py` / `abilities.py` payloads if user DTO should expose `authProvider` (optional read-only)

**Steps:**
1. Add nullable `oidc_issuer`, `oidc_sub`, `auth_provider` (`local`|`oidc`, default `local`).
2. Lightweight migration: ADD COLUMN for sqlite + postgres (same pattern as existing password columns).
3. Unique constraint/index on `(oidc_issuer, oidc_sub)` where both non-null (partial unique if postgres; app-level uniqueness check acceptable for sqlite if partial index is awkward — document choice).
4. Keep `password_hash` NOT NULL with default `""` for SSO users.

**Commit:** `feat(auth): store OIDC issuer/sub on users`

---

### Task 3: OIDC client — discovery, PKCE, state, claims

**Files:**
- Create: `mds-backend/src/mds/services/auth/oidc.py`
- Create: `mds-backend/tests/test_oidc_service.py`
- Modify: `mds-backend/pyproject.toml` (add deps: `httpx`, JWT/JWKS library — prefer one well-supported stack, e.g. `httpx` + `PyJWT[crypto]` or `authlib`)

**Steps:**
1. Fetch and cache OIDC discovery document from issuer.
2. Generate PKCE verifier/challenge + `state` + `nonce`; store in short-TTL server store (in-memory dict OK for single-instance v1; document multi-instance limitation).
3. Build authorize URL; exchange `code` at token endpoint with client secret + verifier.
4. Validate ID token: issuer, audience (`client_id`), signature via JWKS, `nonce`, expiry.
5. Extract email, names, `sub`, groups from configured claim names (groups may be list of strings).
6. Pure function `resolve_role_from_groups(groups, admin_group, member_group) -> "admin" | "member" | None` with admin-wins rule.
7. Unit tests for mapping and validation failure cases (no network).

**Commit:** `feat(auth): add OIDC PKCE client and group role mapping`

---

### Task 4: OIDC login + callback routes + user upsert

**Files:**
- Create or modify: `mds-backend/src/mds/routers/oidc.py` (mount under `/api/v1`)
- Modify: `mds-backend/src/mds/main.py` (include router)
- Create: `mds-backend/tests/test_oidc_flow.py` (httpx ASGI + mocked discovery/token/JWKS)
- Modify: `mds-backend/README.md` (endpoints + env)

**Steps:**
1. Mount the same OIDC router at prefixes `/api/auth` and `/api/v1/auth` in `main.py` (both login and callback aliases).
2. `GET /api/auth/login?redirect=` and `GET /api/v1/auth/login?redirect=` — 404/403 if not SSO; else redirect to IdP.
3. `GET /api/auth/callback` (canonical) and `GET /api/v1/auth/callback` (alias) — validate state; exchange; map role; if `None` redirect to `{APP_ORIGIN}/login?error=not_provisioned`. Default `OIDC_REDIRECT_URI` / MyIAM registration must be `{API_PUBLIC_URL}/api/auth/callback`.
3. Upsert user:
   - Find by `(issuer, sub)`; else by email if single match and unlinked; else create.
   - Set `auth_provider=oidc`, sync `role`, names, email; `password_hash=""` if new.
   - Reject inactive users.
4. `create_session` + set cookie; redirect to safe same-origin path (`redirect` or `/projects`).
5. Errors → `{APP_ORIGIN}/login?error=sso_failed`.
6. Integration tests: member login, admin login, neither denied, second login role sync (member→admin).

**Commit:** `feat(auth): OIDC login/callback minting mds_session`

---

### Task 5: Gate local password + user mutation APIs in SSO mode

**Files:**
- Modify: `mds-backend/src/mds/routers/auth.py`
- Modify: `mds-backend/tests/test_auth.py` (and/or new cases)

**Steps:**
1. Shared dependency or helper `require_local_auth()` raising 403 `"Password authentication is disabled"` when SSO.
2. Apply to: `POST /setup`, `POST /login`, `POST /user/password`, `POST /user/password/reset`, admin create-user, admin password-reset, and **PATCH user role** (and any endpoint that sets role/password).
3. `GET /users` remains allowed for admins (read-only directory of users who have signed in).
4. Optional: allow PATCH `is_active` only if already supported and product wants local disable — if not already clear, leave deactivate for a follow-up; do not add group editing.
5. Tests: each gated route returns 403 under SSO; login/callback still work.

**Commit:** `fix(auth): disable password and role mutations when AUTH_MODE=sso`

---

### Task 6: Frontend guards + login SSO UX

**Files:**
- Modify: `mds-ui/src/app/core/guards/auth.guard.ts` (+ spec)
- Modify: `mds-ui/src/app/features/auth/login-page/login-page.component.{ts,html,scss,spec.ts}`
- Modify: i18n `mds-ui/public/assets/i18n/en.json`, `fr.json`
- Modify: setup/reset routes handling if needed (hide or redirect when SSO)

**Steps:**
1. When `ssoEnabled` / `authMode === 'sso'`: `authGuard` / `guestGuard` / `setupGuard` must not send users to `/setup` (treat setup complete).
2. Login page: if SSO, show primary “Sign in with SSO” button that navigates to `/api/auth/login` with optional `redirect` query (full page navigation, not XHR).
3. Hide email/password form in SSO mode.
4. Map `?error=sso_failed|not_provisioned` to translated messages.
5. Specs: SSO vs local rendering; error banner.

**Commit:** `feat(ui): SSO-only login page and skip setup when SSO`

---

### Task 7: Frontend users page + password chrome under SSO

**Files:**
- Modify: `mds-ui/src/app/features/auth/users-page/users-page.component.{ts,html,spec.ts}`
- Modify: navbar user menu / any change-password entry if present
- Modify: i18n keys for read-only / SSO-managed copy

**Steps:**
1. When SSO: hide “Add user”, role selectors on create/edit, temporary password + reset password actions.
2. Show short helper text: access and roles are managed in MyIAM / directory (keep copy product-neutral if preferred: “managed by your identity provider”).
3. Role column remains visible (synced from last login) but not editable.
4. Hide change-password UI when password auth disabled.
5. Specs cover hidden actions when SSO.

**Commit:** `feat(ui): read-only users directory when SSO enabled`

---

### Task 8: Docs + local verification notes

**Files:**
- Modify: `mds-backend/README.md`
- Modify: `mds-ui/README.md` (auth mode note)
- Optionally: `docs/MDS_BACKEND_PLATFORM_SETUP.md` short SSO subsection
- Create or update `.env.example` under `mds-backend/` if the repo uses one

**Steps:**
1. Document all env vars, MyIAM registration redirect URI, and the two-group model.
2. Note: groups claim must match `OIDC_ADMIN_GROUP` / `OIDC_MEMBER_GROUP` exactly as emitted by MyIAM.
3. Document `AUTH_MODE=local` vs `sso` behavior matrix briefly.
4. Manual smoke checklist (checkbox) for implementers.

**Commit:** `docs(auth): document SSO OIDC configuration and group mapping`

---

## Manual smoke (after implementation)

- [ ] `AUTH_MODE=local`: existing setup/login/password flows still work.
- [ ] `AUTH_MODE=sso` with mock or real MyIAM: login button redirects to IdP.
- [ ] Admin-group user lands in app as `admin`; member-group as `member`.
- [ ] User in neither group sees not-provisioned error; no session cookie.
- [ ] Moving user from member→admin group updates role on next login.
- [ ] Users page: no create / role edit / password reset in SSO mode.
- [ ] `/setup` not reachable / redirects away when SSO.
- [ ] Chromium + Firefox login page OK; no horizontal scroll.

## Out of scope (do not implement in this plan)

- OpenFGA group sync
- SCIM
- Break-glass CLI admin (B3)
- RP-initiated IdP logout
- Multi-instance shared OIDC state store (Redis)

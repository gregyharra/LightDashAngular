# Language control in user menu (mds-ui)

**Date:** 2026-08-27  
**Status:** Approved direction (Approach A) — awaiting final user review of this spec  
**Scope:** `mds-ui` navbar user menu + settings sidebar only  
**Depends on:** existing `LanguageService` / ngx-translate (`mds.lang`, `en` | `fr`)

## Problem

Language is only switchable from the Settings sidebar. Users expect it on the avatar menu (next to Paramètres / Déconnexion), without opening Settings.

## Goals

1. Move language switching into the **navbar user menu** as a nested submenu.
2. **Remove** the Language `mat-select` from the settings sidebar (user menu is the only UI control).
3. Keep existing resolution/persistence/locale sync via `LanguageService` unchanged.

## Non-goals

- Navbar chrome next to the avatar (always-visible control).
- New languages beyond `en` / `fr`.
- Changing browser-default or `localStorage` key behavior.
- Backend localization.

## Decisions

| Decision | Choice |
|----------|--------|
| Placement | Inside avatar `mat-menu`, above Paramètres |
| Control UX | Nested submenu: Language → English / Français |
| Active language | Checkmark (or equivalent) on the current option |
| Settings sidebar | Remove Language control entirely |
| Shared component | Not required — single call site after move |

## Design

### User menu (`navbar-user-menu`)

Between the disabled header and Paramètres:

1. **Language** `mat-menu-item` with `language` icon + nested `matMenuTriggerFor`.
2. Nested panel with two items:
   - English → `LanguageService.setLanguage('en')`
   - Français → `LanguageService.setLanguage('fr')`
3. Mark the active language (e.g. `mat-icon` check / `aria-checked`).
4. Switching applies immediately (same as today); menu may close on selection (Material default is fine).

### Settings sidebar

- Delete the Language `mat-form-field` / `mat-select` block and related styles.
- Drop unused imports (`FormsModule`, `MatSelectModule`, `MatFormFieldModule` if unused elsewhere) and `onLanguageChange`.
- Keep Change password / Logout / project links as today.

### Tests / i18n

- Move or rewrite settings-sidebar language tests to cover the user-menu nested control.
- Reuse existing keys (`settings.language.label`, `.en`, `.fr`) or add `nav.language*` aliases if clearer for the menu — prefer reusing existing keys to avoid catalog churn.

## Success criteria

- User can switch EN ↔ FR from the avatar menu without opening Settings.
- Settings sidebar no longer shows a Language control.
- Preference still persists in `mds.lang` and updates UI + locale in place.
- Focused unit tests pass for the user-menu language behavior.

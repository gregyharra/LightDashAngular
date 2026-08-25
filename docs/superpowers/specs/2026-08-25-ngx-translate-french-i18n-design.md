# ngx-translate French i18n (mds-ui)

**Date:** 2026-08-25  
**Status:** Draft — awaiting user review before implementation plan  
**Scope:** `mds-ui` only  
**Approach:** Single `en.json` / `fr.json` catalogs + `LanguageService` (Approach A)

## Problem

`mds-ui` has no i18n stack today. User-facing copy is hardcoded English across ~55 templates plus TypeScript strings (dialogs, confirms, snackbars, config labels). There is no language preference, no French catalog, and number/date formatting is often forced to `en-US`.

We need French as a first-class UI language alongside English, with browser-aware defaulting, a settings switcher, and locale-aware dates/numbers.

## Goals

1. Introduce **ngx-translate** (`@ngx-translate/core` + HTTP loader) into the Angular 20 standalone app.
2. Ship complete **English and French** catalogs covering all user-facing UI strings.
3. Resolve language as: **saved preference → browser/OS → English fallback**.
4. Provide a **Language** control in settings that switches immediately and persists in `localStorage`.
5. Keep **Angular/Material date and number formatting** in sync with the active language (`en-US` / `fr-FR`).
6. Migrate the full UI in **phased order** so each phase keeps `en.json` and `fr.json` in lockstep.

## Non-goals

- Backend/API message localization.
- Languages beyond `en` and `fr`.
- Typed/generated translation key maps (may revisit later).
- Feature-scoped lazy translation files.
- Translating warehouse/dbt field names, user-authored content, chart data, SQL, emails, or UUIDs.
- Translating opaque backend error payloads (only our known UI fallback strings).
- Navbar Help / Notifications / Settings chrome toggles (separate workstream).

## Decisions (locked)

| Decision | Choice |
|----------|--------|
| Library | ngx-translate (`@ngx-translate/core` + `@ngx-translate/http-loader`) |
| Catalog shape | Single pair: `assets/i18n/en.json` and `fr.json`, nested by domain |
| Default language | If `mds.lang` unset: browser/OS (`fr*` → `fr`, else `en`). If set: always use stored value |
| Persistence | `localStorage` key `mds.lang` (`en` \| `fr`); written on first resolution and on every switch |
| Fallback | Always English (ngx-translate fallback language) |
| Switcher | Settings sidebar only; `mat-select` with English / Français; immediate apply |
| Locale sync | Yes — strings + `registerLocaleData(fr)` + `DateAdapter` / `MAT_DATE_LOCALE` / `toLocaleString` / `document.documentElement.lang` |
| Coverage | Full UI (all templates + TS user-facing strings) |
| Reload on switch | No — language and locale update in place |

## Architecture

```text
app.config.ts
  ├── provideTranslateService / TranslateHttpLoader → assets/i18n/{lang}.json
  ├── provideAppInitializer → LanguageService.init()
  │     (independent of AppStateService.bootstrap; may run in parallel)
  └── Locale: registerLocaleData(localeFr); DateAdapter + MAT_DATE_LOCALE updated by LanguageService

Templates / components
  ├── | translate / translate directive
  └── TranslateService.get / .instant for TS strings

Settings sidebar
  └── mat-select Language → LanguageService.setLanguage('en' | 'fr')
```

**Stack**

- Add `@ngx-translate/core` and `@ngx-translate/http-loader` to `mds-ui` (versions compatible with Angular 20).
- Register translation providers in `mds-ui/src/app/app.config.ts` (standalone).
- Catalogs live at `mds-ui/src/assets/i18n/en.json` and `mds-ui/src/assets/i18n/fr.json` (ensure `angular.json` assets include `src/assets`).

**UI usage**

- Templates: `{{ 'nav.projects' | translate }}` or the `translate` directive / attribute binding.
- TypeScript: `TranslateService.instant` / `get` for confirms, snackbars, dynamic labels, and constants that today hold English literals (e.g. chart type option labels).

## Language resolution

Order of precedence:

1. `localStorage.getItem('mds.lang')` if value is exactly `en` or `fr`.
2. Else inspect `navigator.languages` (then `navigator.language`): any tag starting with `fr` (case-insensitive) → `fr`; otherwise `en`.
3. ngx-translate fallback language for missing keys is always `en`.

After resolving (including first visit) and on every switch:

- Call `TranslateService.use(lang)`.
- Set `document.documentElement.lang` to `en` or `fr`.
- Persist `mds.lang` (so a first-visit browser choice is sticky until the user changes it in settings).
- Sync date/number locale (see Locale sync).

## LanguageService

New root service (`providedIn: 'root'`), e.g. `mds-ui/src/app/core/i18n/language.service.ts`.

**Responsibilities**

- `init()` — resolve language, ensure translations are usable, apply locale; invoked from `provideAppInitializer` so the first painted UI uses the correct language.
- `setLanguage(lang: 'en' | 'fr')` — update ngx-translate, `localStorage`, `document.documentElement.lang`, and Material/Angular locale in place (no reload).
- Expose a readonly signal for current language (`'en' | 'fr'`) and BCP-47 locale (`'en-US' | 'fr-FR'`) for the settings control and formatting helpers.
- Expose `formatNumber(value: number, options?: Intl.NumberFormatOptions): string` (or equivalent thin helper) so call sites stop hardcoding `'en-US'`.

**Dependencies**

- `TranslateService`
- Material `DateAdapter` and `MAT_DATE_LOCALE` (update via `DateAdapter.setLocale` / injecting the locale token pattern used by the app)
- Browser `localStorage` and `navigator`

## Key naming and JSON structure

- Same key tree in `en.json` and `fr.json`; every key present in one must exist in the other.
- Nested by domain, then screen/component, then role. Leaves are `camelCase`.

Locked top-level domains:

- `common` — shared actions and states (Cancel, Save, Delete, Loading, generic errors)
- `auth` — login, setup, reset password
- `nav` — in-scope navigation labels only (not the separate navbar Help/Notifications/Settings toggle work)
- `settings` — settings shell, sidebar labels, language control
- `projects`, `warehouses`, `users`
- `explorer`, `charts`, `dashboards`, `tables`, `lineage`, `export`

Examples:

```json
{
  "common": { "cancel": "Cancel", "save": "Save" },
  "settings": {
    "title": "Settings",
    "language": { "label": "Language", "en": "English", "fr": "Français" },
    "changePassword": "Change password",
    "logout": "Logout"
  }
}
```

- Interpolation via ngx-translate params (`{{name}}`).
- Plurals via ICU / ngx-translate plural forms only where count-dependent copy is required.
- Missing French keys fall back to English via ngx-translate fallback language.

## Phased migration order

Each phase updates **both** JSON files and the migrated call sites together.

1. **Infra** — packages, HTTP loader, `LanguageService`, bootstrap hook, empty/skeleton `en`/`fr`, locale sync hooks.
2. **Shell + auth** — settings nav labels, login / setup / reset-password, shared buttons and common dialogs.
3. **Settings area** — projects / warehouses / users pages; language switcher live and usable.
4. **Lists & hubs** — charts/dashboards lists, tables hub, export dialogs and related chrome.
5. **Explore / charts / dashboards** — workspace chrome, config panels, chart-type and section labels, empty states.
6. **Lineage + leftover TS** — confirms, snackbars, `instant()` strings, remaining hardcoded `toLocaleString('en-US')` on UI paths.
7. **Sweep** — grep for remaining user-facing English literals; fix gaps; keep catalogs in lockstep.

Mock fixtures used only in tests may stay English unless they assert visible UI copy.

## Switcher UX

- Location: **settings sidebar** (`SettingsSidebarNavComponent`), always visible (not admin-gated).
- Placement: above **Change password** and **Logout**.
- Control: labeled **Language** using Material `mat-select` with two options: **English** (`en`) and **Français** (`fr`).
- Behavior: change applies immediately via `LanguageService.setLanguage` (no separate Save).
- Collapsed sidebar: language icon + tooltip only, matching existing nav item patterns (select may open from the icon affordance or a compact control that fits the collapsed rail without horizontal overflow).
- Explicitly out of scope: navbar Help / Notifications / Settings toggles.

## Locale sync

When language is initialized or changed:

1. `TranslateService.use(lang)`.
2. `document.documentElement.lang = lang` (`en` or `fr`).
3. Persist `mds.lang`.
4. At app startup, always `registerLocaleData(localeFr)` once. Active formatting locale is `fr-FR` when `lang === 'fr'`, else `en-US`.
5. Call `DateAdapter.setLocale(...)` and keep `MAT_DATE_LOCALE` aligned so datepickers and formatted dates match.
6. User-visible number formatting uses `LanguageService` locale helper (replace hardcoded `toLocaleString('en-US')` on UI paths such as export dialog and run-query hints).

Language and locale must update **in place without a full page reload**.

## Out of scope / non-translated content

**Do not translate**

- dbt / warehouse model and field names and labels coming from the semantic layer
- User-authored titles, descriptions, and dashboard/chart names
- Chart/table data values and raw SQL
- Emails, UUIDs, and other identifiers
- Opaque backend error response bodies

**Do translate**

- All chrome, buttons, menus, empty states, dialogs, confirms, snackbars, and known client-side error fallbacks we own

## Success criteria

1. With browser language French (and no `mds.lang`), the app loads in French; with English browser, it loads in English.
2. Changing Language in settings switches UI strings and date/number formatting immediately and survives reload via `localStorage`.
3. `en.json` and `fr.json` share an identical key tree; missing keys fall back to English without blank UI.
4. All user-facing UI strings in templates and TS have been migrated (sweep finds no remaining chrome literals).
5. Non-content rules respected: warehouse field names and user content remain as provided by data/API.
6. Chromium and Firefox both show translated UI and correct locale formatting for dates/numbers.

## Testing notes

- Unit-test `LanguageService` resolution order (storage → browser → default) and `setLanguage` persistence.
- Smoke settings switcher: EN ↔ FR updates sidebar labels and `document.documentElement.lang`.
- Spot-check one datepicker and one `toLocaleString` surface after switch.
- No requirement for full visual regression of every screen in v1; phase sweep + targeted component tests where strings are asserted today.

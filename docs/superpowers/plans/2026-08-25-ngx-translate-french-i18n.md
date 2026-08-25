# ngx-translate French i18n Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ngx-translate with complete English/French catalogs, browser-aware language defaulting, a settings Language switcher, and locale-synced dates/numbers across all user-facing `mds-ui` chrome.

**Architecture:** Standalone Angular 20 app uses `@ngx-translate/core` v18 + HTTP loader for a single `en.json` / `fr.json` pair under `mds-ui/src/assets/i18n/`. A root `LanguageService` resolves `mds.lang` → browser → `en`, applies `TranslateService.use`, syncs `document.documentElement.lang` and Material/Angular locale (`en-US` / `fr-FR`), and exposes `formatNumber`. Settings sidebar hosts an immediate-apply Language `mat-select`. UI strings migrate in phases with catalogs kept in lockstep.

**Tech Stack:** Angular 20 standalone, `@ngx-translate/core@^18`, `@ngx-translate/http-loader@^18`, Angular Material, Karma/Jasmine unit tests.

## Global Constraints

- Scope: `mds-ui` only.
- Catalogs: identical key trees in `en.json` and `fr.json`; nested domains `common`, `auth`, `nav`, `settings`, `projects`, `warehouses`, `users`, `explorer`, `charts`, `dashboards`, `tables`, `lineage`, `export`; leaf keys `camelCase`.
- Persistence key: `mds.lang` with values exactly `en` | `fr`.
- Fallback language: always `en`.
- Do **not** translate dbt/warehouse field names, user-authored titles/descriptions, chart/table data, SQL, emails, UUIDs, or opaque API error bodies — only owned UI chrome and known client fallbacks.
- Do **not** change navbar Help / Notifications / Settings toggle workstream (`navbar-secondary-actions` / related chrome) unless a conflict forces a minimal fix.
- Language switch applies in place (no full page reload).
- Match existing code style; minimal unrelated diffs.
- UI: Chromium + Firefox; no horizontal page scroll; reuse shared components where appropriate.
- Commit once per task after tests pass (message style: `feat(i18n): …` / `test(i18n): …`).
- Work on feature branch in an isolated worktree; do not commit secrets or `.tmp/`.

---

## File structure (locked)

| Path | Responsibility |
|------|----------------|
| `mds-ui/src/app/core/i18n/language.service.ts` | Resolve/persist language; drive TranslateService + locale sync; `formatNumber` |
| `mds-ui/src/app/core/i18n/language.service.spec.ts` | Unit tests for resolution order and `setLanguage` |
| `mds-ui/src/assets/i18n/en.json` | English catalog |
| `mds-ui/src/assets/i18n/fr.json` | French catalog (same keys) |
| `mds-ui/src/app/app.config.ts` | `provideTranslateService`, HTTP loader, `registerLocaleData(fr)`, date adapter, `LanguageService.init` initializer |
| `mds-ui/angular.json` | Include `src/assets` in build assets (output `/assets`) |
| `mds-ui/src/app/layout/settings-sidebar-nav/settings-sidebar-nav.component.ts` | Translated settings nav + Language `mat-select` |
| Feature templates/TS under `mds-ui/src/app/features/**` and shared chrome | Migrate user-facing strings phase by phase |

---

### Task 1: Infra — packages, LanguageService, catalogs skeleton, bootstrap

**Files:**
- Create: `mds-ui/src/app/core/i18n/language.service.ts`
- Create: `mds-ui/src/app/core/i18n/language.service.spec.ts`
- Create: `mds-ui/src/assets/i18n/en.json`
- Create: `mds-ui/src/assets/i18n/fr.json`
- Modify: `mds-ui/package.json` / `mds-ui/package-lock.json` (via npm install)
- Modify: `mds-ui/src/app/app.config.ts`
- Modify: `mds-ui/angular.json` (build + test `assets` arrays)

**Interfaces:**
- Consumes: `@ngx-translate/core` `TranslateService`, Material `DateAdapter`, `MAT_DATE_LOCALE`
- Produces:
  - `export type AppLanguage = 'en' | 'fr'`
  - `export type AppLocale = 'en-US' | 'fr-FR'`
  - `LanguageService.init(): Promise<void>`
  - `LanguageService.setLanguage(lang: AppLanguage): Promise<void>`
  - `LanguageService.language: Signal<AppLanguage>` (readonly)
  - `LanguageService.locale: Signal<AppLocale>` (readonly)
  - `LanguageService.formatNumber(value: number, options?: Intl.NumberFormatOptions): string`
  - Storage key constant `MDS_LANG_STORAGE_KEY = 'mds.lang'`

- [ ] **Step 1: Write the failing LanguageService tests**

Create `mds-ui/src/app/core/i18n/language.service.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { DateAdapter, MAT_DATE_LOCALE } from '@angular/material/core';
import { provideNativeDateAdapter } from '@angular/material/core';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { firstValueFrom, of } from 'rxjs';
import {
  LanguageService,
  MDS_LANG_STORAGE_KEY,
} from './language.service';

class FakeTranslateService {
  use = jasmine.createSpy('use').and.callFake((lang: string) => of(lang));
  get = jasmine.createSpy('get').and.callFake((key: string) => of(key));
  instant = jasmine.createSpy('instant').and.callFake((key: string) => key);
}

describe('LanguageService', () => {
  let service: LanguageService;
  let translate: FakeTranslateService;
  let storage: Storage;
  let doc: Document;
  let dateAdapter: DateAdapter<unknown>;

  beforeEach(() => {
    storage = window.localStorage;
    storage.removeItem(MDS_LANG_STORAGE_KEY);

    TestBed.configureTestingModule({
      providers: [
        provideTranslateService({ fallbackLang: 'en', lang: 'en' }),
        { provide: TranslateService, useClass: FakeTranslateService },
        provideNativeDateAdapter(),
        LanguageService,
      ],
    });

    service = TestBed.inject(LanguageService);
    translate = TestBed.inject(TranslateService) as unknown as FakeTranslateService;
    doc = TestBed.inject(DOCUMENT);
    dateAdapter = TestBed.inject(DateAdapter);
    spyOn(dateAdapter, 'setLocale').and.callThrough();
  });

  afterEach(() => {
    storage.removeItem(MDS_LANG_STORAGE_KEY);
  });

  it('uses mds.lang when set to en or fr', async () => {
    storage.setItem(MDS_LANG_STORAGE_KEY, 'fr');
    await service.init();
    expect(service.language()).toBe('fr');
    expect(service.locale()).toBe('fr-FR');
    expect(translate.use).toHaveBeenCalledWith('fr');
    expect(doc.documentElement.lang).toBe('fr');
    expect(storage.getItem(MDS_LANG_STORAGE_KEY)).toBe('fr');
  });

  it('ignores invalid mds.lang and falls back to browser', async () => {
    storage.setItem(MDS_LANG_STORAGE_KEY, 'de');
    spyOnProperty(window.navigator, 'languages', 'get').and.returnValue(['en-US']);
    spyOnProperty(window.navigator, 'language', 'get').and.returnValue('en-US');
    await service.init();
    expect(service.language()).toBe('en');
  });

  it('uses French when browser languages include fr* and storage empty', async () => {
    spyOnProperty(window.navigator, 'languages', 'get').and.returnValue([
      'fr-FR',
      'en-US',
    ]);
    await service.init();
    expect(service.language()).toBe('fr');
    expect(storage.getItem(MDS_LANG_STORAGE_KEY)).toBe('fr');
  });

  it('defaults to English when browser is non-French', async () => {
    spyOnProperty(window.navigator, 'languages', 'get').and.returnValue(['de-DE']);
    spyOnProperty(window.navigator, 'language', 'get').and.returnValue('de-DE');
    await service.init();
    expect(service.language()).toBe('en');
    expect(service.locale()).toBe('en-US');
  });

  it('setLanguage updates translate, storage, html lang, and date locale', async () => {
    await service.init();
    await service.setLanguage('fr');
    expect(service.language()).toBe('fr');
    expect(translate.use).toHaveBeenCalledWith('fr');
    expect(storage.getItem(MDS_LANG_STORAGE_KEY)).toBe('fr');
    expect(doc.documentElement.lang).toBe('fr');
    expect(dateAdapter.setLocale).toHaveBeenCalledWith('fr-FR');
  });

  it('formatNumber uses active locale', async () => {
    await service.setLanguage('fr');
    const formatted = service.formatNumber(1234.5, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    expect(formatted).toMatch(/1[\s\u00a0\u202f]?234,5/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `mds-ui`):

```bash
npx ng test --no-watch --browsers=ChromeHeadless --include='**/language.service.spec.ts'
```

Expected: FAIL (file `language.service.ts` missing / compilation error).

- [ ] **Step 3: Install packages and add assets config**

From `mds-ui`:

```bash
npm install @ngx-translate/core@^18 @ngx-translate/http-loader@^18
```

In `mds-ui/angular.json`, in **both** `build.options.assets` and `test.options.assets` (if present; else only build), keep the existing `public` entry and **add**:

```json
{
  "glob": "**/*",
  "input": "src/assets",
  "output": "assets"
}
```

Create skeleton catalogs:

`mds-ui/src/assets/i18n/en.json`:

```json
{
  "common": {
    "cancel": "Cancel",
    "save": "Save",
    "delete": "Delete",
    "confirm": "Confirm",
    "dismiss": "Dismiss",
    "loading": "Loading…",
    "close": "Close"
  },
  "auth": {},
  "nav": {},
  "settings": {
    "title": "Settings",
    "language": {
      "label": "Language",
      "en": "English",
      "fr": "Français"
    },
    "changePassword": "Change password",
    "logout": "Logout",
    "projects": "Projects",
    "warehouses": "Warehouses",
    "users": "Users"
  },
  "projects": {},
  "warehouses": {},
  "users": {},
  "explorer": {},
  "charts": {},
  "dashboards": {},
  "tables": {},
  "lineage": {},
  "export": {}
}
```

`mds-ui/src/assets/i18n/fr.json` — same keys; French values for filled leaves:

```json
{
  "common": {
    "cancel": "Annuler",
    "save": "Enregistrer",
    "delete": "Supprimer",
    "confirm": "Confirmer",
    "dismiss": "Fermer",
    "loading": "Chargement…",
    "close": "Fermer"
  },
  "auth": {},
  "nav": {},
  "settings": {
    "title": "Paramètres",
    "language": {
      "label": "Langue",
      "en": "English",
      "fr": "Français"
    },
    "changePassword": "Changer le mot de passe",
    "logout": "Déconnexion",
    "projects": "Projets",
    "warehouses": "Entrepôts",
    "users": "Utilisateurs"
  },
  "projects": {},
  "warehouses": {},
  "users": {},
  "explorer": {},
  "charts": {},
  "dashboards": {},
  "tables": {},
  "lineage": {},
  "export": {}
}
```

- [ ] **Step 4: Implement LanguageService**

Create `mds-ui/src/app/core/i18n/language.service.ts`:

```typescript
import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { DateAdapter, MAT_DATE_LOCALE } from '@angular/material/core';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';

export type AppLanguage = 'en' | 'fr';
export type AppLocale = 'en-US' | 'fr-FR';

export const MDS_LANG_STORAGE_KEY = 'mds.lang';

function isAppLanguage(value: string | null | undefined): value is AppLanguage {
  return value === 'en' || value === 'fr';
}

function localeFor(lang: AppLanguage): AppLocale {
  return lang === 'fr' ? 'fr-FR' : 'en-US';
}

function detectBrowserLanguage(): AppLanguage {
  const tags = [
    ...(navigator.languages ?? []),
    navigator.language,
  ].filter(Boolean);
  for (const tag of tags) {
    if (tag.toLowerCase().startsWith('fr')) {
      return 'fr';
    }
  }
  return 'en';
}

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translate = inject(TranslateService);
  private readonly document = inject(DOCUMENT);
  private readonly dateAdapter = inject(DateAdapter);
  private readonly matDateLocale = inject(MAT_DATE_LOCALE, { optional: true });

  private readonly languageSignal = signal<AppLanguage>('en');
  private readonly localeSignal = signal<AppLocale>('en-US');

  readonly language = this.languageSignal.asReadonly();
  readonly locale = this.localeSignal.asReadonly();

  async init(): Promise<void> {
    const stored = localStorage.getItem(MDS_LANG_STORAGE_KEY);
    const lang = isAppLanguage(stored) ? stored : detectBrowserLanguage();
    await this.apply(lang);
  }

  async setLanguage(lang: AppLanguage): Promise<void> {
    await this.apply(lang);
  }

  formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
    return new Intl.NumberFormat(this.localeSignal(), options).format(value);
  }

  private async apply(lang: AppLanguage): Promise<void> {
    const locale = localeFor(lang);
    await firstValueFrom(this.translate.use(lang));
    this.document.documentElement.lang = lang;
    localStorage.setItem(MDS_LANG_STORAGE_KEY, lang);
    this.dateAdapter.setLocale(locale);
    if (
      this.matDateLocale &&
      typeof this.matDateLocale === 'object' &&
      'set' in (this.matDateLocale as object)
    ) {
      // no-op for string token; locale string providers are replaced via setLocale
    }
    this.languageSignal.set(lang);
    this.localeSignal.set(locale);
  }
}
```

Note: Prefer injecting `MAT_DATE_LOCALE` as a writable pattern if the app uses a string provider — with `provideNativeDateAdapter()`, `DateAdapter.setLocale(locale)` is the primary sync. Keep `MAT_DATE_LOCALE` provided as `'en-US'` initially; `setLocale` on the adapter is sufficient for Material date formatting when datepickers appear later.

- [ ] **Step 5: Wire app.config.ts**

Update `mds-ui/src/app/app.config.ts`:

```typescript
import { ApplicationConfig, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { MAT_DIALOG_DEFAULT_OPTIONS } from '@angular/material/dialog';
import { provideNativeDateAdapter } from '@angular/material/core';
import { provideRouter } from '@angular/router';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { mockApiInterceptor } from './core/mock/mock-api.interceptor';
import { AppStateService } from './core/services/app-state.service';
import { LanguageService } from './core/i18n/language.service';
import { provideAppStore } from './core/store';

registerLocaleData(localeFr);

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    ...provideAppStore(),
    provideRouter(routes),
    provideAnimationsAsync(),
    provideNativeDateAdapter(),
    {
      provide: MAT_DIALOG_DEFAULT_OPTIONS,
      useValue: {
        enterAnimationDuration: '0ms',
        exitAnimationDuration: '0ms',
        autoFocus: 'first-tabbable',
      },
    },
    provideHttpClient(withFetch(), withInterceptors([mockApiInterceptor, authInterceptor])),
    provideTranslateService({
      loader: provideTranslateHttpLoader({
        prefix: '/assets/i18n/',
        suffix: '.json',
      }),
      fallbackLang: 'en',
      lang: 'en',
    }),
    provideAppInitializer(() => inject(LanguageService).init()),
    provideAppInitializer(() => inject(AppStateService).bootstrap()),
  ],
};
```

- [ ] **Step 6: Run LanguageService tests — expect PASS**

```bash
npx ng test --no-watch --browsers=ChromeHeadless --include='**/language.service.spec.ts'
```

Expected: all specs PASS. Fix FakeTranslateService provider conflicts if needed by using only `{ provide: TranslateService, useClass: FakeTranslateService }` without `provideTranslateService`, or a minimal stub loader.

- [ ] **Step 7: Commit**

```bash
git add mds-ui/package.json mds-ui/package-lock.json mds-ui/angular.json \
  mds-ui/src/app/app.config.ts \
  mds-ui/src/app/core/i18n/language.service.ts \
  mds-ui/src/app/core/i18n/language.service.spec.ts \
  mds-ui/src/assets/i18n/en.json \
  mds-ui/src/assets/i18n/fr.json
git commit -m "$(cat <<'EOF'
feat(i18n): add ngx-translate, LanguageService, and catalog skeletons

EOF
)"
```

---

### Task 2: Shell + auth + shared confirm defaults

**Files:**
- Modify: `mds-ui/src/assets/i18n/en.json`, `fr.json` (add `auth.*`, `nav.*`, expand `common.*`)
- Modify: `mds-ui/src/app/layout/app-shell/app-shell.component.ts` + `.html` (in-scope nav labels only — New / Browse / Metrics / Ask AI / menu items; leave Help/Notifications/Settings toggles alone)
- Modify: `mds-ui/src/app/features/auth/login-page/login-page.component.ts` + `.html`
- Modify: `mds-ui/src/app/features/auth/setup-page/setup-page.component.ts` + `.html`
- Modify: `mds-ui/src/app/features/auth/reset-password-page/reset-password-page.component.ts` + `.html`
- Modify: `mds-ui/src/app/shared/confirm-dialog/confirm-dialog.component.ts`
- Modify: `mds-ui/src/app/layout/navbar/navbar-user-menu.component.ts` (Change password dialog strings + user menu Settings/Logout if present — these are shared chrome; do not touch secondary Help/Notifications toggles)
- Modify: `mds-ui/src/app/core/api/api-error.service.ts` (`Dismiss` → translate)
- Test: extend or add focused specs where existing tests assert English copy (e.g. `app-shell.component.spec.ts`) — provide `TranslateService` stub or `provideTranslateService` with inline translations

**Interfaces:**
- Consumes: `LanguageService` (already initialized), `TranslatePipe` / `TranslateService`
- Produces: catalog keys under `auth`, `nav`, `common` used by later tasks

- [ ] **Step 1: Add catalog keys (both JSON files in lockstep)**

English additions (merge into existing trees):

```json
{
  "common": {
    "cancel": "Cancel",
    "save": "Save",
    "delete": "Delete",
    "confirm": "Confirm",
    "dismiss": "Dismiss",
    "loading": "Loading…",
    "close": "Close",
    "admin": "Admin"
  },
  "auth": {
    "signInTitle": "Sign in",
    "signInSubtitle": "Sign in to continue to your workspace.",
    "email": "Email",
    "password": "Password",
    "signIn": "Sign in",
    "signingIn": "Signing in…",
    "forgotHint": "Forgot your password? Ask an admin to reset it — they will give you a reset link (or a temporary password that requires choosing a new one).",
    "setupTitle": "Create admin account",
    "setupSubtitle": "Welcome. Set up the first administrator to manage this workspace.",
    "firstName": "First name",
    "lastName": "Last name",
    "confirmPassword": "Confirm password",
    "createAdmin": "Create admin",
    "creating": "Creating…",
    "resetTitle": "Reset password",
    "resetSubtitle": "Choose a new password for your account.",
    "newPassword": "New password",
    "resetSubmit": "Update password",
    "resetting": "Updating…",
    "currentPassword": "Current password",
    "changePasswordTitle": "Change password"
  },
  "nav": {
    "home": "Home",
    "new": "New",
    "browse": "Browse",
    "metrics": "Metrics",
    "askAi": "Ask AI",
    "dashboard": "Dashboard",
    "exploreData": "Explore data",
    "newDashboard": "New dashboard",
    "moreNavigation": "More navigation",
    "settings": "Settings",
    "logout": "Logout",
    "noMatches": "No matches"
  }
}
```

French equivalents (accurate, natural UI French — e.g. `signInTitle`: `Connexion`, `exploreData`: `Explorer les données`, `askAi`: `Demander à l'IA`).

- [ ] **Step 2: Write / update a failing shell or confirm test**

In `mds-ui/src/app/shared/confirm-dialog/confirm-dialog.component.ts`, defaults must use translate keys. Add a small spec `confirm-dialog.component.spec.ts` if none exists:

```typescript
it('renders translated default cancel and delete labels', () => {
  // open dialog without cancelLabel/confirmLabel/title
  // expect translated Cancel / Delete / Confirm via stub TranslateService.instant
});
```

Or update `app-shell.component.spec.ts` expectations to use translation keys / stubbed French/English strings after wiring `TranslatePipe`.

Run the chosen test — expect FAIL before template migration.

- [ ] **Step 3: Migrate templates and TS**

Pattern for templates — import `TranslatePipe` in the component `imports` array:

```html
<h1 class="auth-card__title">{{ 'auth.signInTitle' | translate }}</h1>
<button>{{ submitting() ? ('auth.signingIn' | translate) : ('auth.signIn' | translate) }}</button>
```

For confirm dialog defaults:

```typescript
private readonly translate = inject(TranslateService);
// in template:
{{ data.title ?? ('common.confirm' | translate) }}
{{ data.cancelLabel ?? ('common.cancel' | translate) }}
{{ data.confirmLabel ?? ('common.delete' | translate) }}
```

For `ApiErrorService`:

```typescript
this.snackBar.open(message, this.translate.instant('common.dismiss'), { ... });
```

Call sites that pass English `title`/`message`/`confirmLabel` into confirm dialogs stay English until later tasks migrate those call sites — defaults only in this task.

App shell: replace visible nav chrome strings listed under `nav.*`. Do **not** modify Help/Notifications/Settings toggle implementation files beyond what is required if the same template file holds both (then only touch the in-scope labels).

- [ ] **Step 4: Run focused tests**

```bash
npx ng test --no-watch --browsers=ChromeHeadless --include='**/app-shell.component.spec.ts'
npx ng test --no-watch --browsers=ChromeHeadless --include='**/language.service.spec.ts'
```

Expected: PASS. Fix any TestBed missing `TranslatePipe` / `provideTranslateService`.

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(i18n): translate shell chrome, auth pages, and shared defaults

EOF
)"
```

---

### Task 3: Settings area + Language switcher

**Files:**
- Modify: `mds-ui/src/app/layout/settings-sidebar-nav/settings-sidebar-nav.component.ts`
- Modify: `mds-ui/src/app/layout/settings-sidebar-nav/settings-sidebar-nav.component.spec.ts`
- Modify: `mds-ui/src/app/features/projects/projects-page/**`
- Modify: `mds-ui/src/app/features/projects/project-create-page/**`
- Modify: `mds-ui/src/app/features/projects/project-edit-page/**` (chrome only; table-link confirm messages may wait for Task 6 if heavy)
- Modify: `mds-ui/src/app/features/warehouses/**` (pages, form, create dialog)
- Modify: `mds-ui/src/app/features/auth/users-page/**`
- Modify: `mds-ui/src/assets/i18n/en.json`, `fr.json` (`settings.*`, `projects.*`, `warehouses.*`, `users.*`)

**Interfaces:**
- Consumes: `LanguageService.language()`, `LanguageService.setLanguage`
- Produces: live Language control in settings sidebar

- [ ] **Step 1: Write failing settings sidebar language test**

Extend `settings-sidebar-nav.component.spec.ts`:

```typescript
it('shows a Language select and calls setLanguage on change', async () => {
  const languageService = {
    language: () => 'en' as const,
    setLanguage: jasmine.createSpy('setLanguage').and.resolveTo(undefined),
  };
  // provide LanguageService mock + TranslateService / pipe
  fixture.detectChanges();
  const select = fixture.nativeElement.querySelector(
    '[data-testid="settings-language-select"]',
  );
  expect(select).toBeTruthy();
  // trigger selection change to 'fr'
  expect(languageService.setLanguage).toHaveBeenCalledWith('fr');
});
```

Also assert Projects / Warehouses / Users / Change password / Logout use translated labels (stub `instant`/`pipe` returning keys or French).

Run test — expect FAIL (no select yet).

- [ ] **Step 2: Implement Language mat-select in settings sidebar**

Place the control **above** Change password and Logout. Expanded sidebar: labeled Language `mat-select` with options English / Français. Collapsed: keep icon + tooltip (`settings.language.label`); use a compact control that does not cause horizontal overflow (`min-width: 0`, no fixed width wider than rail).

```typescript
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService, AppLanguage } from '../../core/i18n/language.service';

// in template (above change password):
<div class="settings-nav__language" [attr.title]="'settings.language.label' | translate">
  <mat-icon fontIcon="language" aria-hidden="true"></mat-icon>
  <mat-form-field appearance="outline" class="settings-nav__language-field" subscriptSizing="dynamic">
    <mat-label>{{ 'settings.language.label' | translate }}</mat-label>
    <mat-select
      data-testid="settings-language-select"
      [ngModel]="languageService.language()"
      (ngModelChange)="onLanguageChange($event)"
    >
      <mat-option value="en">{{ 'settings.language.en' | translate }}</mat-option>
      <mat-option value="fr">{{ 'settings.language.fr' | translate }}</mat-option>
    </mat-select>
  </mat-form-field>
</div>
```

```typescript
protected readonly languageService = inject(LanguageService);

protected onLanguageChange(lang: AppLanguage): void {
  void this.languageService.setLanguage(lang);
}
```

Translate existing Settings header and nav item labels with `| translate`.

- [ ] **Step 3: Migrate settings feature pages**

For each settings-related HTML/TS file listed above: replace user-facing chrome (titles, buttons, empty states, column headers that are UI chrome, confirm()/snackbar owned strings) with keys under `projects`, `warehouses`, `users`, `settings`. Keep warehouse connection names and project names from API untranslated.

Add all new keys to **both** JSON files.

- [ ] **Step 4: Run tests**

```bash
npx ng test --no-watch --browsers=ChromeHeadless --include='**/settings-sidebar-nav.component.spec.ts'
npx ng test --no-watch --browsers=ChromeHeadless --include='**/language.service.spec.ts'
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(i18n): add settings Language switcher and translate settings area

EOF
)"
```

---

### Task 4: Lists & hubs — charts, dashboards, tables, export

**Files:**
- Modify: `mds-ui/src/app/features/charts/charts-list-page/**`
- Modify: `mds-ui/src/app/features/dashboards/dashboards-list-page/**`
- Modify: `mds-ui/src/app/features/dashboards/dashboard-create-page/**` (list/create chrome)
- Modify: `mds-ui/src/app/features/tables/table-hub-page/**` (hub chrome; dialogs chrome)
- Modify: `mds-ui/src/app/features/tables/filterable-links-table/**`
- Modify: `mds-ui/src/app/features/tables/link-dialog/**`
- Modify: `mds-ui/src/app/features/export/export-dialog.component.ts` + `.html`
- Modify: `mds-ui/src/app/features/export/start-export.ts` (snackbar/messages + replace `toLocaleString('en-US')` with `LanguageService.formatNumber`)
- Modify: `mds-ui/src/assets/i18n/en.json`, `fr.json` (`charts`, `dashboards`, `tables`, `export`)

**Interfaces:**
- Consumes: `LanguageService.formatNumber`
- Produces: translated list/hub/export chrome

- [ ] **Step 1: Failing test for export number formatting**

In `mds-ui/src/app/features/export/export-dialog.component.ts` (or a thin helper), replace hardcoded `'en-US'`. Add/extend spec:

```typescript
it('formats csvMaxLimit with LanguageService locale', () => {
  // languageService.locale mock 'fr-FR' → expect French grouping/decimal
});
```

Run — FAIL until implementation.

- [ ] **Step 2: Implement formatNumber at export call sites**

```typescript
// export-dialog.component.ts
private readonly language = inject(LanguageService);
get csvMaxLimitLabel(): string {
  return this.language.formatNumber(this.data.csvMaxLimit);
}
```

```typescript
// start-export.ts — inject/pass LanguageService or formatNumber callback
const n = opts.formatNumber(poll.rowCount ?? opts.csvMaxLimit);
```

Do **not** change `mds-ui/src/app/core/mock/fixtures/query-results.fixture.ts` (mock fixture may stay English/`en-US` per spec).

- [ ] **Step 3: Migrate list/hub templates and TS strings**

Replace chrome in the files listed. User chart/dashboard **names** remain raw. Empty states, buttons (New chart, Export, Delete, …), dialog titles owned by UI → keys.

Keep en/fr lockstep.

- [ ] **Step 4: Run tests**

```bash
npx ng test --no-watch --browsers=ChromeHeadless --include='**/start-export.spec.ts'
npx ng test --no-watch --browsers=ChromeHeadless --include='**/language.service.spec.ts'
```

Expected: PASS (update `start-export.spec.ts` mocks if signature changes).

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(i18n): translate lists, table hub, and export chrome

EOF
)"
```

---

### Task 5: Explore / charts / dashboards workspace

**Files:**
- Modify: `mds-ui/src/app/features/explorer/**` (pages, panels, custom-metric dialog, constants labels)
- Modify: `mds-ui/src/app/features/charts/chart-view-page/**`
- Modify: `mds-ui/src/app/features/charts/chart-visualization/**`
- Modify: `mds-ui/src/app/features/charts/chart-details-dialog/**`
- Modify: `mds-ui/src/app/features/charts/save-chart-dialog/**`
- Modify: `mds-ui/src/app/features/charts/query-results-panel/**`
- Modify: `mds-ui/src/app/features/dashboards/dashboard-view-page/**`
- Modify: `mds-ui/src/app/features/dashboards/dashboard-filters-bar/**`
- Modify: `mds-ui/src/app/features/dashboards/dashboard-filter-dialog/**`
- Modify: `mds-ui/src/app/features/dashboards/dashboard-tile-settings-dialog/**`
- Modify: `mds-ui/src/app/features/dashboards/dashboard-chart-tile/**`
- Modify: `mds-ui/src/app/features/explorer/tables-chart-config-panel/tables-chart-config.constants.ts` — change `label` to **translation keys** (e.g. `charts.types.verticalBar`), resolve with `translate.instant` or pipe at render time
- Modify: `mds-ui/src/assets/i18n/en.json`, `fr.json` (`explorer`, `charts`, `dashboards`)

**Interfaces:**
- Consumes: `TranslateService.instant` for constant-driven labels
- Produces: translated explore/chart/dashboard chrome and chart-type/section labels

- [ ] **Step 1: Failing test for chart type option labels**

Update `tables-chart-config-panel.component.spec.ts` (or constants consumer test) so labels are translation keys resolved via stub:

```typescript
expect(options[0].labelKey).toBe('charts.types.verticalBar');
// after render, visible text equals stubbed translation
```

Prefer renaming field from `label` to `labelKey` if that avoids double-translation; if that churns too many call sites, keep `label` but store the key string and translate at display. Run — FAIL.

- [ ] **Step 2: Migrate constants + panel**

Example constants:

```typescript
export const TABLES_CHART_TYPE_OPTIONS: TablesChartTypeOption[] = [
  { value: 'vertical_bar', labelKey: 'charts.types.verticalBar', icon: 'bar_chart' },
  // ...
];
```

Template: `{{ option.labelKey | translate }}`.

Add matching keys in en/fr for all chart types and config section labels (`charts.sections.layout`, etc.).

- [ ] **Step 3: Migrate remaining explore/chart/dashboard chrome**

All buttons, empty states, panel titles, tooltips, snackbars owned by UI. Leave field names from semantic layer untouched. AI assistant panel chrome under `explorer` or a nested `ai` key inside `explorer` if needed — still migrate user-facing strings.

- [ ] **Step 4: Run tests**

```bash
npx ng test --no-watch --browsers=ChromeHeadless --include='**/tables-chart-config-panel.component.spec.ts'
npx ng test --no-watch --browsers=ChromeHeadless --include='**/tables-fields-panel.component.spec.ts'
```

Expected: PASS after TestBed translate providers.

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(i18n): translate explore, chart, and dashboard workspace chrome

EOF
)"
```

---

### Task 6: Lineage + leftover TypeScript strings

**Files:**
- Modify: `mds-ui/src/app/features/lineage/**`
- Modify: remaining confirm/snackbar/message literals in:
  - `mds-ui/src/app/features/projects/project-edit-page/project-edit-page.component.ts`
  - `mds-ui/src/app/features/warehouses/warehouses-page/warehouses-page.component.ts`
  - `mds-ui/src/app/features/tables/table-hub-page/table-hub-page.component.ts`
  - `mds-ui/src/app/features/charts/chart-view-page/chart-view-page.component.ts`
  - `mds-ui/src/app/features/explorer/explorer-page/explorer-page.component.ts`
  - `mds-ui/src/app/features/export/start-export.ts` (any remaining English messages)
  - `mds-ui/src/app/core/api/api-error.service.ts` (`queryErrorWarning` default fallback)
  - any other `confirm('…')` / `snackBar.open('…'` owned strings under `mds-ui/src/app`
- Modify: `mds-ui/src/assets/i18n/en.json`, `fr.json` (`lineage`, leftover domains)
- Grep for remaining `toLocaleString('en-US')` on UI paths and fix via `LanguageService` (exclude mock fixtures)

**Interfaces:**
- Consumes: `TranslateService.instant` / `get`
- Produces: no remaining owned English chrome in listed TS paths

- [ ] **Step 1: Inventory with grep (document in commit message / notes)**

```bash
rg -n "confirm\(['\"]|snackBar\.open\(['\"]|toLocaleString\(['\"]en-US['\"]\)" mds-ui/src/app --glob '!**/mock/**'
rg -n "mat-dialog-title>|mat-label>[A-Za-z]" mds-ui/src/app --glob '*.html' | head -80
```

Use the inventory to drive this task’s key additions.

- [ ] **Step 2: Migrate lineage templates + TS**

Translate lineage page chrome, legend, detail panel chrome, folder search chrome. Do not translate model/column names from lineage data.

- [ ] **Step 3: Replace leftover instant strings**

Example:

```typescript
this.translate.instant('warehouses.confirmDelete');
this.translate.instant('common.queryFailed');
```

- [ ] **Step 4: Run focused + language tests**

```bash
npx ng test --no-watch --browsers=ChromeHeadless --include='**/language.service.spec.ts'
npx ng test --no-watch --browsers=ChromeHeadless --include='**/lineage-neighborhood-utils.spec.ts'
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(i18n): translate lineage and remaining TypeScript UI strings

EOF
)"
```

---

### Task 7: Sweep — lockstep catalogs and residual chrome

**Files:**
- Modify: any remaining templates/TS with user-facing English chrome under `mds-ui/src/app`
- Modify: `mds-ui/src/assets/i18n/en.json`, `fr.json` (fill gaps; ensure identical key trees)
- Optional helper script (only if needed, keep YAGNI): one-off node script to diff key trees — or use a small test

**Interfaces:**
- Produces: success criteria from design met for coverage

- [ ] **Step 1: Add a key-tree parity unit test**

Create `mds-ui/src/app/core/i18n/i18n-catalogs.spec.ts`:

```typescript
import en from '../../../assets/i18n/en.json';
import fr from '../../../assets/i18n/fr.json';

function keys(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object') return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    keys(v, prefix ? `${prefix}.${k}` : k),
  );
}

describe('i18n catalogs', () => {
  it('en and fr share the same key tree', () => {
    expect(keys(fr).sort()).toEqual(keys(en).sort());
  });

  it('has no empty string leaves in en or fr', () => {
    for (const catalog of [en, fr]) {
      for (const path of keys(catalog)) {
        const parts = path.split('.');
        let cur: unknown = catalog;
        for (const p of parts) cur = (cur as Record<string, unknown>)[p];
        expect(typeof cur).withContext(path).toBe('string');
        expect(cur as string).withContext(path).not.toBe('');
      }
    }
  });
});
```

If JSON import needs `resolveJsonModule` — enable in `mds-ui/tsconfig.app.json` / `tsconfig.spec.json` if not already; otherwise load via `fetch` in the test or `readFileSync` is not available in browser Karma — prefer `import` with `resolveJsonModule: true`.

Run — FAIL if trees diverge or empties remain from earlier phases.

- [ ] **Step 2: Grep sweep and fix residuals**

```bash
rg -n ">(Save|Cancel|Delete|Loading|Settings|Sign in|Logout|Export|Confirm)<" mds-ui/src/app --glob '*.html'
rg -n "'[A-Z][a-z]+ [a-z]" mds-ui/src/app/features --glob '*.ts' | head -100
```

Migrate remaining owned chrome. Skip mock fixtures and non-UI strings.

- [ ] **Step 3: Run catalog test + broader UI specs**

```bash
npx ng test --no-watch --browsers=ChromeHeadless --include='**/i18n-catalogs.spec.ts'
npx ng test --no-watch --browsers=ChromeHeadless --include='**/language.service.spec.ts'
npx ng test --no-watch --browsers=ChromeHeadless --include='**/settings-sidebar-nav.component.spec.ts'
```

Expected: PASS.

- [ ] **Step 4: Manual verification checklist (document in report)**

1. Clear `localStorage.mds.lang`; set browser language FR → app loads French; `document.documentElement.lang === 'fr'`.
2. Settings → Language → English → UI + `lang` flip immediately; reload keeps English.
3. Spot-check export limit formatting in FR vs EN.
4. Confirm a warehouse field name still shows API/dbt label untranslated.

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(i18n): sweep remaining chrome and enforce en/fr catalog parity

EOF
)"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|------------------|------|
| ngx-translate + HTTP loader | Task 1 |
| en.json / fr.json Approach A | Task 1 + all |
| Resolution storage → browser → en | Task 1 |
| Settings Language mat-select | Task 3 |
| Locale sync + formatNumber | Task 1, 4, 6 |
| Phased full UI migration | Tasks 2–7 |
| Non-translated content rules | Global Constraints + Tasks 4–7 |
| No Help/Notifications/Settings toggle work | Global Constraints + Task 2 |
| Catalog lockstep + fallback en | Tasks 1, 7 |
| Chromium + Firefox | Global Constraints (smoke in Task 7 checklist) |

No TBD/placeholder steps remain. Types (`AppLanguage`, `AppLocale`, `MDS_LANG_STORAGE_KEY`, `formatNumber`) are consistent across tasks.

---

## Execution notes

- Use **Subagent-Driven Development** only (workspace rule).
- Create/use an isolated git worktree via `using-git-worktrees` before Task 1.
- Follow TDD on each task (red → green → commit).
- Do not pause for “should I continue?” between tasks.

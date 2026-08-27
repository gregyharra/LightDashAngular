# Language in user menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move language switching into the navbar avatar menu as a nested submenu and remove it from the settings sidebar.

**Architecture:** `NavbarUserMenuComponent` gains a Language nested `mat-menu` wired to existing `LanguageService.setLanguage`. Settings sidebar language `mat-select` and related tests are removed/rewritten. Persistence and locale sync stay in `LanguageService`.

**Tech Stack:** Angular 20 standalone, Angular Material menus, ngx-translate, Karma/Jasmine.

## Global Constraints

- Scope: `mds-ui` navbar user menu + settings sidebar only.
- Nested submenu UX (Approach A): Language → English / Français; checkmark on active.
- Remove Language control from settings sidebar entirely (user menu is the only UI).
- Reuse existing keys `settings.language.label` / `.en` / `.fr` (no catalog churn required).
- `LanguageService` API unchanged: `language()`, `setLanguage('en' | 'fr')`.
- Match existing code style; minimal unrelated diffs.
- Chromium + Firefox; no horizontal page scroll.
- Commit once per task after tests pass.

---

## File structure

| Path | Responsibility |
|------|----------------|
| `mds-ui/src/app/layout/navbar/navbar-user-menu.component.html` | Nested Language submenu |
| `mds-ui/src/app/layout/navbar/navbar-user-menu.component.ts` | Wire `LanguageService` |
| `mds-ui/src/app/layout/navbar/navbar-user-menu.component.spec.ts` | Language menu tests (create) |
| `mds-ui/src/app/layout/settings-sidebar-nav/settings-sidebar-nav.component.ts` | Remove language UI |
| `mds-ui/src/app/layout/settings-sidebar-nav/settings-sidebar-nav.component.spec.ts` | Drop language-select assertions |

---

### Task 1: User-menu Language nested submenu

**Files:**
- Create: `mds-ui/src/app/layout/navbar/navbar-user-menu.component.spec.ts`
- Modify: `mds-ui/src/app/layout/navbar/navbar-user-menu.component.ts`
- Modify: `mds-ui/src/app/layout/navbar/navbar-user-menu.component.html`
- Modify: `mds-ui/src/app/layout/navbar/navbar-user-menu.component.scss` (only if needed for checkmark alignment)

**Interfaces:**
- Consumes: `LanguageService.language(): AppLanguage`, `LanguageService.setLanguage(lang: AppLanguage): Promise<void>`
- Produces: user-visible Language nested menu; `data-testid="user-menu-language"` on trigger item; `data-testid="user-menu-language-en"` / `user-menu-language-fr` on options

- [ ] **Step 1: Write the failing user-menu language tests**

Create `mds-ui/src/app/layout/navbar/navbar-user-menu.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { LanguageService } from '../../core/i18n/language.service';
import { AppStateService } from '../../core/services/app-state.service';
import { AuthService } from '../../core/services/auth.service';
import { NavbarUserMenuComponent } from './navbar-user-menu.component';

describe('NavbarUserMenuComponent language', () => {
  let fixture: ComponentFixture<NavbarUserMenuComponent>;
  const languageService = {
    language: jasmine.createSpy('language').and.returnValue('en' as const),
    setLanguage: jasmine.createSpy('setLanguage').and.resolveTo(undefined),
  };

  beforeEach(async () => {
    languageService.language.and.returnValue('en');
    languageService.setLanguage.calls.reset();

    await TestBed.configureTestingModule({
      imports: [NavbarUserMenuComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'en', lang: 'en' }),
        { provide: LanguageService, useValue: languageService },
        {
          provide: AppStateService,
          useValue: {
            user: () => ({
              firstName: 'Demo',
              lastName: 'Analyst',
              email: 'demo@lightdash.com',
            }),
            isAdmin: () => true,
          },
        },
        { provide: AuthService, useValue: { logout: () => of(null) } },
      ],
    }).compileComponents();

    TestBed.inject(TranslateService).setTranslation('en', {
      nav: { userMenu: 'User menu', settings: 'Settings', logout: 'Logout' },
      common: { admin: 'Admin' },
      settings: {
        language: { label: 'Language', en: 'English', fr: 'Français' },
      },
    });

    fixture = TestBed.createComponent(NavbarUserMenuComponent);
    fixture.detectChanges();
  });

  it('calls setLanguage when Français is selected', () => {
    const fr = fixture.debugElement.query(
      By.css('[data-testid="user-menu-language-fr"]'),
    );
    expect(fr).toBeTruthy();
    fr.triggerEventHandler('click', new MouseEvent('click'));
    expect(languageService.setLanguage).toHaveBeenCalledWith('fr');
  });

  it('marks the active language', () => {
    const en = fixture.debugElement.query(
      By.css('[data-testid="user-menu-language-en"]'),
    );
    expect(en.nativeElement.textContent).toContain('check');
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless --include='**/navbar-user-menu.component.spec.ts'
```

Expected: FAIL (missing testids / LanguageService wiring).

- [ ] **Step 3: Implement nested Language menu**

In `navbar-user-menu.component.ts`, inject `LanguageService`, expose `languageService`, add:

```typescript
protected setLanguage(lang: AppLanguage): void {
  void this.languageService.setLanguage(lang);
}
```

Import `LanguageService`, `AppLanguage`.

In `navbar-user-menu.component.html`, insert **above** the Settings link:

```html
  <button
    mat-menu-item
    type="button"
    [matMenuTriggerFor]="languageMenu"
    data-testid="user-menu-language"
  >
    <mat-icon>language</mat-icon>
    <span class="user-menu__item-label">{{ 'settings.language.label' | translate }}</span>
  </button>
  <mat-menu #languageMenu="matMenu" xPosition="before" class="user-menu__language-menu">
    <button
      mat-menu-item
      type="button"
      data-testid="user-menu-language-en"
      (click)="setLanguage('en')"
    >
      @if (languageService.language() === 'en') {
        <mat-icon>check</mat-icon>
      } @else {
        <mat-icon class="user-menu__check-spacer"></mat-icon>
      }
      <span class="user-menu__item-label">{{ 'settings.language.en' | translate }}</span>
    </button>
    <button
      mat-menu-item
      type="button"
      data-testid="user-menu-language-fr"
      (click)="setLanguage('fr')"
    >
      @if (languageService.language() === 'fr') {
        <mat-icon>check</mat-icon>
      } @else {
        <mat-icon class="user-menu__check-spacer"></mat-icon>
      }
      <span class="user-menu__item-label">{{ 'settings.language.fr' | translate }}</span>
    </button>
  </mat-menu>
```

Add SCSS for spacer icon if needed so inactive rows align:

```scss
.user-menu__check-spacer {
  visibility: hidden;
}
```

- [ ] **Step 4: Run tests — expect PASS**

Same `ng test` command as Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mds-ui/src/app/layout/navbar/navbar-user-menu.component.ts \
  mds-ui/src/app/layout/navbar/navbar-user-menu.component.html \
  mds-ui/src/app/layout/navbar/navbar-user-menu.component.scss \
  mds-ui/src/app/layout/navbar/navbar-user-menu.component.spec.ts
git commit -m "feat(ui): add Language nested menu to avatar user menu"
```

---

### Task 2: Remove Language from settings sidebar

**Files:**
- Modify: `mds-ui/src/app/layout/settings-sidebar-nav/settings-sidebar-nav.component.ts`
- Modify: `mds-ui/src/app/layout/settings-sidebar-nav/settings-sidebar-nav.component.spec.ts`

**Interfaces:**
- Consumes: none from Task 1 beyond shared `LanguageService` remaining available app-wide
- Produces: settings sidebar without language UI

- [ ] **Step 1: Update failing settings tests**

In `settings-sidebar-nav.component.spec.ts`:

- Remove `LanguageService` provider and language translation keys if unused.
- Change the second test to only assert settings labels (no `settings-language-select`).
- Assert there is **no** `[data-testid="settings-language-select"]`.

```typescript
  it('shows translated settings labels without a language select', () => {
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain('Paramètres');
    expect(text).toContain('Projets');
    expect(text).toContain('Entrepôts');
    expect(text).toContain('Utilisateurs');
    expect(text).toContain('Changer le mot de passe');
    expect(text).toContain('Déconnexion');

    expect(
      fixture.debugElement.query(By.css('[data-testid="settings-language-select"]')),
    ).toBeNull();
  });
```

- [ ] **Step 2: Run test — expect FAIL** (select still present)

```bash
cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless --include='**/settings-sidebar-nav.component.spec.ts'
```

- [ ] **Step 3: Remove language UI from settings sidebar**

Delete the `.settings-nav__language` block from the template, `onLanguageChange`, `languageService` inject, and unused imports (`FormsModule`, `MatFormFieldModule`, `MatSelectModule`, `LanguageService`, `AppLanguage`). Delete language-related styles (`.settings-nav__language*`).

- [ ] **Step 4: Run settings + user-menu tests — expect PASS**

```bash
cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless \
  --include='**/settings-sidebar-nav.component.spec.ts' \
  --include='**/navbar-user-menu.component.spec.ts'
```

- [ ] **Step 5: Commit**

```bash
git add mds-ui/src/app/layout/settings-sidebar-nav/settings-sidebar-nav.component.ts \
  mds-ui/src/app/layout/settings-sidebar-nav/settings-sidebar-nav.component.spec.ts
git commit -m "refactor(ui): remove Language select from settings sidebar"
```

---

## Plan self-review

1. Spec coverage: nested menu, remove settings control, LanguageService unchanged, reuse keys, tests moved — all tasked.
2. No placeholders.
3. Testids and `setLanguage('en'|'fr')` consistent across tasks.

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { LanguageService } from '../../core/i18n/language.service';
import { AppStateService } from '../../core/services/app-state.service';
import { AuthService } from '../../core/services/auth.service';
import { NavbarUserMenuComponent } from './navbar-user-menu.component';

function openLanguageMenu(fixture: ComponentFixture<NavbarUserMenuComponent>): void {
  fixture.debugElement.nativeElement
    .querySelector('.user-menu__trigger')
    .click();
  fixture.detectChanges();
  const languageTrigger = document.querySelector(
    '[data-testid="user-menu-language"]',
  ) as HTMLElement;
  languageTrigger.click();
  fixture.detectChanges();
}

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
    openLanguageMenu(fixture);
    const fr = document.querySelector(
      '[data-testid="user-menu-language-fr"]',
    ) as HTMLElement;
    expect(fr).toBeTruthy();
    fr.click();
    expect(languageService.setLanguage).toHaveBeenCalledWith('fr');
  });

  it('renders a settings gear as the menu trigger', () => {
    const trigger = fixture.nativeElement.querySelector(
      '.user-menu__trigger',
    ) as HTMLButtonElement;
    expect(trigger.getAttribute('aria-label')).toBe('User menu');
    expect(trigger.querySelector('mat-icon')?.textContent?.trim()).toBe(
      'settings',
    );
  });

  it('keeps Settings reachable from the menu', () => {
    fixture.nativeElement.querySelector('.user-menu__trigger').click();
    fixture.detectChanges();
    const settings = document.querySelector(
      '[data-testid="user-menu-settings"]',
    ) as HTMLElement | null;
    expect(settings).toBeTruthy();
    expect(settings?.textContent).toContain('Settings');
  });

  it('marks the active language', () => {
    openLanguageMenu(fixture);
    const en = document.querySelector(
      '[data-testid="user-menu-language-en"]',
    ) as HTMLElement;
    expect(en.textContent).toContain('check');
  });
});

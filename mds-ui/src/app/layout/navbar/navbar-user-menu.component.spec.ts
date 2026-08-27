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

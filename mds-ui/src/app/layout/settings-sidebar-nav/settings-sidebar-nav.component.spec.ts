import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { LanguageService } from '../../core/i18n/language.service';
import { AppStateService } from '../../core/services/app-state.service';
import { AuthService } from '../../core/services/auth.service';
import { SettingsSidebarNavComponent } from './settings-sidebar-nav.component';

@Component({
  selector: 'app-settings-nav-host',
  imports: [SettingsSidebarNavComponent],
  template: `
    <div class="page-sidebar" [class.page-sidebar--collapsed]="collapsed">
      <app-settings-sidebar-nav />
    </div>
  `,
})
class SettingsNavHostComponent {
  collapsed = false;
}

describe('SettingsSidebarNavComponent', () => {
  let fixture: ComponentFixture<SettingsNavHostComponent>;
  const languageService = {
    language: () => 'en' as const,
    setLanguage: jasmine.createSpy('setLanguage').and.resolveTo(undefined),
  };

  beforeEach(async () => {
    languageService.setLanguage.calls.reset();
    await TestBed.configureTestingModule({
      imports: [SettingsNavHostComponent],
      providers: [
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'en', lang: 'fr' }),
        { provide: LanguageService, useValue: languageService },
        {
          provide: AppStateService,
          useValue: {
            user: () => ({ email: 'demo@lightdash.com' }),
            isAdmin: () => true,
          },
        },
        {
          provide: AuthService,
          useValue: { logout: () => of(null) },
        },
      ],
    }).compileComponents();

    TestBed.inject(TranslateService).setTranslation('fr', {
      settings: {
        title: 'Paramètres',
        projects: 'Projets',
        warehouses: 'Entrepôts',
        users: 'Utilisateurs',
        changePassword: 'Changer le mot de passe',
        logout: 'Déconnexion',
        language: {
          label: 'Langue',
          en: 'English',
          fr: 'Français',
        },
      },
    });
    fixture = TestBed.createComponent(SettingsNavHostComponent);
  });

  it('hides email and Settings label when the sidebar is collapsed', () => {
    fixture.componentInstance.collapsed = true;
    fixture.detectChanges();

    const header = fixture.nativeElement.querySelector(
      '.settings-nav__header',
    ) as HTMLElement;
    const styles = getComputedStyle(header);

    expect(styles.opacity).toBe('0');
    expect(styles.overflow).toBe('hidden');
    expect(header.getBoundingClientRect().height).toBe(0);
  });

  it('shows translated settings labels and changes the language', () => {
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain('Paramètres');
    expect(text).toContain('Projets');
    expect(text).toContain('Entrepôts');
    expect(text).toContain('Utilisateurs');
    expect(text).toContain('Changer le mot de passe');
    expect(text).toContain('Déconnexion');

    const select = fixture.debugElement.query(
      By.css('[data-testid="settings-language-select"]'),
    );
    expect(select).toBeTruthy();
    select.triggerEventHandler('ngModelChange', 'fr');

    expect(languageService.setLanguage).toHaveBeenCalledWith('fr');
  });
});

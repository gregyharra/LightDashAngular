import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { AppStateService } from '@mds-ui/core';
import { AuthService } from '@mds-ui/core';
import { SettingsShellFacade } from '../../core/facades/settings-shell.facade';
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

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SettingsNavHostComponent],
      providers: [
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'en', lang: 'fr' }),
        SettingsShellFacade,
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
      },
    });
    fixture = TestBed.createComponent(SettingsNavHostComponent);
  });

  it('keeps collapse targets inside the collapsed sidebar', () => {
    fixture.componentInstance.collapsed = true;
    fixture.detectChanges();

    expect(
      fixture.debugElement.query(
        By.css('.page-sidebar--collapsed .settings-nav__header'),
      ),
    ).toBeTruthy();
    expect(
      fixture.debugElement.queryAll(
        By.css('.page-sidebar--collapsed .settings-nav__item-label'),
      ).length,
    ).toBeGreaterThan(0);
  });

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
});

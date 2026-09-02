import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNativeDateAdapter } from '@angular/material/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { Store } from '@ngrx/store';
import {
  provideTranslateService,
  TranslateService,
} from '@ngx-translate/core';
import { of } from 'rxjs';
import { HealthResults } from '../../core/api/api.types';
import { AppStateService } from '../../core/services/app-state.service';
import { ActiveProjectService } from '../../core/services/active-project.service';
import { ProjectSummary } from '../../core/models/project.model';
import { AiAssistantPanelComponent } from '../../features/ai/ai-assistant-panel/ai-assistant-panel.component';
import { AiAssistantUiService } from '../../features/ai/ai-assistant-ui.service';
import { ProjectsService } from '../../features/projects/projects.service';
import { NavbarSearchComponent } from '../navbar/navbar-search.component';
import { AppShellComponent } from './app-shell.component';

@Component({
  selector: 'app-ai-assistant-panel',
  template: '',
})
class AiAssistantPanelStub {}

@Component({
  selector: 'app-navbar-search',
  template: '',
})
class NavbarSearchStub {}

const PROJECT: ProjectSummary = {
  projectUuid: 'project-1',
  name: 'Demo',
  type: 'DEFAULT',
  createdByUserUuid: null,
  createdByUserName: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  upstreamProjectUuid: null,
  expiresAt: null,
};

describe('AppShellComponent navbar identity', () => {
  let fixture: ComponentFixture<AppShellComponent>;
  let component: AppShellComponent;
  let healthSignal: ReturnType<typeof signal<HealthResults | null>>;
  let aiUi: AiAssistantUiService;
  let activeProject: ActiveProjectService;

  beforeEach(async () => {
    healthSignal = signal<HealthResults | null>({
      version: 'test',
      isAuthenticated: true,
      askAiEnabled: false,
    });

    await TestBed.configureTestingModule({
      imports: [AppShellComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNativeDateAdapter(),
        provideTranslateService({ fallbackLang: 'en', lang: 'en' }),
        ActiveProjectService,
        AiAssistantUiService,
        {
          provide: Store,
          useValue: { dispatch: () => undefined },
        },
        {
          provide: AppStateService,
          useValue: {
            health: healthSignal.asReadonly(),
            user: signal(null).asReadonly(),
            isAdmin: signal(false).asReadonly(),
          },
        },
        {
          provide: ProjectsService,
          useValue: {
            list: () => of([PROJECT]),
          },
        },
      ],
    })
      .overrideComponent(AppShellComponent, {
        remove: { imports: [AiAssistantPanelComponent, NavbarSearchComponent] },
        add: { imports: [AiAssistantPanelStub, NavbarSearchStub] },
      })
      .compileComponents();

    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', {
      nav: {
        home: 'Home',
        brandName: 'Data Platform',
        brandNameLead: 'Data',
        brandNameTrail: 'Platform',
        askAi: 'Ask AI',
        help: 'Help',
        notifications: 'Notifications',
        settings: 'Settings',
        userMenu: 'User menu',
        logout: 'Logout',
      },
      common: { admin: 'Admin' },
    });

    fixture = TestBed.createComponent(AppShellComponent);
    component = fixture.componentInstance;
    aiUi = TestBed.inject(AiAssistantUiService);
    activeProject = TestBed.inject(ActiveProjectService);
    activeProject.setProjects([PROJECT]);
    fixture.detectChanges();
  });

  it('renders the design-system topbar and brand link', () => {
    expect(fixture.nativeElement.querySelector('ld-app-topbar')).not.toBeNull();

    const brand = fixture.nativeElement.querySelector(
      'ld-brand-mark a[href="/projects"]',
    ) as HTMLAnchorElement | null;
    expect(brand).not.toBeNull();
    expect(brand?.getAttribute('aria-label')).toBe('Data Platform');
    expect(
      fixture.nativeElement.querySelector('ld-brand-mark img'),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('ld-brand-mark')?.textContent,
    ).toContain('Data');
    expect(
      fixture.nativeElement.querySelector('ld-brand-mark')?.textContent,
    ).toContain('Platform');
  });

  it('shows a settings gear user-menu trigger (no standalone settings link)', () => {
    expect(
      fixture.nativeElement.querySelector('a.shell__settings-btn'),
    ).toBeNull();

    const trigger = fixture.nativeElement.querySelector(
      'button.user-menu__trigger',
    ) as HTMLButtonElement | null;
    expect(trigger).not.toBeNull();
    expect(trigger?.getAttribute('aria-label')).toBe('User menu');
    expect(
      trigger?.querySelector('mat-icon')?.textContent?.trim(),
    ).toBe('settings');
  });

  it('hides legacy New / Browse / Metrics primary nav', () => {
    activeProject.setActiveProject(PROJECT.projectUuid);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[aria-label="New"]'),
    ).toBeNull();
    expect(
      fixture.nativeElement.querySelector('[aria-label="Browse"]'),
    ).toBeNull();
    expect(
      fixture.nativeElement.querySelector('[aria-label="Metrics"]'),
    ).toBeNull();
  });

  it('shows project switcher and search when a project is active', () => {
    // setProjects auto-selects the first project
    expect(activeProject.activeProjectUuid()).toBe(PROJECT.projectUuid);
    expect(
      fixture.nativeElement.querySelector('app-navbar-project-switcher'),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('app-navbar-search'),
    ).not.toBeNull();
  });

  it('hides project switcher and search when no project is active', () => {
    activeProject.setProjects([]);
    fixture.detectChanges();

    expect(activeProject.activeProjectUuid()).toBeNull();
    expect(
      fixture.nativeElement.querySelector('app-navbar-project-switcher'),
    ).toBeNull();
    expect(
      fixture.nativeElement.querySelector('app-navbar-search'),
    ).toBeNull();
  });

  it('hides Ask AI when askAiEnabled is false', () => {
    expect(component['askAiEnabled']()).toBeFalse();
    expect(
      fixture.nativeElement.querySelector('[aria-label="Ask AI"]'),
    ).toBeNull();
    expect(
      fixture.nativeElement.querySelector('app-ai-assistant-panel'),
    ).toBeNull();

    component['openAiAssistant']();
    expect(aiUi.open()).toBeFalse();
  });

  it('hides stub Help / Notifications by default', () => {
    expect(component['showHelp']).toBeFalse();
    expect(component['showNotifications']).toBeFalse();
    expect(
      fixture.nativeElement.querySelector('[aria-label="Help"]'),
    ).toBeNull();
    expect(
      fixture.nativeElement.querySelector('[aria-label="Notifications"]'),
    ).toBeNull();
  });

  it('shows Ask AI in the right cluster when askAiEnabled is true', () => {
    healthSignal.set({
      version: 'test',
      isAuthenticated: true,
      askAiEnabled: true,
    });
    fixture.detectChanges();

    expect(component['askAiEnabled']()).toBeTrue();
    const askAi = fixture.nativeElement.querySelector(
      'ld-app-topbar [ldActions] [aria-label="Ask AI"]',
    );
    expect(askAi).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('app-ai-assistant-panel'),
    ).not.toBeNull();

    component['openAiAssistant']();
    expect(aiUi.open()).toBeTrue();
  });
});

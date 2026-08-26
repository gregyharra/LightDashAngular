import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
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

describe('AppShellComponent Ask AI flag', () => {
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
        new: 'New',
        browse: 'Browse',
        metrics: 'Metrics',
        askAi: 'Ask AI',
        dashboard: 'Dashboard',
        exploreData: 'Explore data',
        newDashboard: 'New dashboard',
        moreNavigation: 'More navigation',
        help: 'Help',
        notifications: 'Notifications',
        settings: 'Settings',
        logout: 'Logout',
      },
      common: { admin: 'Admin', moreActions: 'More actions' },
    });

    fixture = TestBed.createComponent(AppShellComponent);
    component = fixture.componentInstance;
    aiUi = TestBed.inject(AiAssistantUiService);
    activeProject = TestBed.inject(ActiveProjectService);
    activeProject.setProjects([PROJECT]);
    fixture.detectChanges();
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

  it('hides stub Help / Notifications / Settings by default', () => {
    expect(component['showHelp']).toBeFalse();
    expect(component['showNotifications']).toBeFalse();
    expect(component['showSettings']).toBeFalse();
    expect(component['showRightOverflowMenu']).toBeFalse();
    expect(
      fixture.nativeElement.querySelector('[aria-label="Help"]'),
    ).toBeNull();
    expect(
      fixture.nativeElement.querySelector('[aria-label="Notifications"]'),
    ).toBeNull();
    expect(
      fixture.nativeElement.querySelector(
        '.shell__nav-group--secondary [aria-label="Settings"]',
      ),
    ).toBeNull();
    expect(
      fixture.nativeElement.querySelector('[aria-label="More actions"]'),
    ).toBeNull();
  });

  it('shows Ask AI and opens the panel when askAiEnabled is true', () => {
    healthSignal.set({
      version: 'test',
      isAuthenticated: true,
      askAiEnabled: true,
    });
    fixture.detectChanges();

    expect(component['askAiEnabled']()).toBeTrue();
    expect(
      fixture.nativeElement.querySelector('[aria-label="Ask AI"]'),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('app-ai-assistant-panel'),
    ).not.toBeNull();

    component['openAiAssistant']();
    expect(aiUi.open()).toBeTrue();
  });
});

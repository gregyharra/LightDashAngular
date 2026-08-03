import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { HealthResults } from '../../core/api/api.types';
import { AppStateService } from '../../core/services/app-state.service';
import { ActiveProjectService } from '../../core/services/active-project.service';
import { ProjectSummary } from '../../core/models/project.model';
import { AiAssistantPanelComponent } from '../../features/ai/ai-assistant-panel/ai-assistant-panel.component';
import { AiAssistantUiService } from '../../features/ai/ai-assistant-ui.service';
import { ProjectsService } from '../../features/projects/projects.service';
import { AppShellComponent } from './app-shell.component';

@Component({
  selector: 'app-ai-assistant-panel',
  template: '',
})
class AiAssistantPanelStub {}

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
        ActiveProjectService,
        AiAssistantUiService,
        {
          provide: AppStateService,
          useValue: {
            health: healthSignal.asReadonly(),
            user: signal(null).asReadonly(),
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
        remove: { imports: [AiAssistantPanelComponent] },
        add: { imports: [AiAssistantPanelStub] },
      })
      .compileComponents();

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

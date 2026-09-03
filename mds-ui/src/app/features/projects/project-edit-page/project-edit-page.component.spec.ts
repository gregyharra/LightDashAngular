import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { LanguageService } from '../../../core/i18n/language.service';
import { ActiveProjectService } from '../../../core/services/active-project.service';
import { LineageService } from '../../lineage/lineage.service';
import { ModelJoinsService } from '../../tables/model-joins.service';
import { ProjectsService } from '../projects.service';
import { WarehouseService } from '../warehouse.service';
import { ProjectEditPageComponent } from './project-edit-page.component';

describe('ProjectEditPageComponent', () => {
  let fixture: ComponentFixture<ProjectEditPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectEditPageComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'en', lang: 'en' }),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ projectUuid: 'project-1' })),
          },
        },
        {
          provide: ProjectsService,
          useValue: {
            get: () =>
              of({
                projectUuid: 'project-1',
                name: 'Analytics',
                warehouseUuid: null,
                gitRepoUrl: null,
                gitDefaultBranch: 'main',
                gitProvider: null,
                gitSubdirectory: null,
                gitUsername: null,
                dbtProjectPath: null,
                dbtTarget: null,
                hasGitToken: false,
              }),
            getRepoStatus: () => of(null),
          },
        },
        {
          provide: WarehouseService,
          useValue: { list: () => of([]) },
        },
        {
          provide: ActiveProjectService,
          useValue: {
            activeProject: signal(null).asReadonly(),
            projects: signal([]).asReadonly(),
            setProjects: () => undefined,
            setActiveProject: () => undefined,
          },
        },
        { provide: LineageService, useValue: {} },
        { provide: ModelJoinsService, useValue: {} },
        { provide: LanguageService, useValue: { formatDate: () => '' } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectEditPageComponent);
    fixture.detectChanges();
  });

  it('renders shared UI page chrome and save action', () => {
    expect(fixture.debugElement.query(By.css('dpf-page-frame'))).toBeTruthy();
    expect(fixture.debugElement.query(By.css('dpf-page-header'))).toBeTruthy();
    expect(
      fixture.debugElement.query(By.css('dpf-button[type="submit"]')),
    ).toBeTruthy();
    expect(
      fixture.debugElement.query(
        By.css('dpf-button[variant="outlined"][tone="neutral"]'),
      ),
    ).toBeTruthy();
  });
});

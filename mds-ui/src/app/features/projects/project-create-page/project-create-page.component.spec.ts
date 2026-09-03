import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { ActiveProjectService } from '../../../core/services/active-project.service';
import { ProjectsService } from '../projects.service';
import { WarehouseService } from '../warehouse.service';
import { ProjectCreatePageComponent } from './project-create-page.component';

describe('ProjectCreatePageComponent', () => {
  let fixture: ComponentFixture<ProjectCreatePageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectCreatePageComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'en', lang: 'en' }),
        {
          provide: WarehouseService,
          useValue: { list: () => of([]) },
        },
        {
          provide: ProjectsService,
          useValue: {},
        },
        {
          provide: ActiveProjectService,
          useValue: {
            projects: signal([]).asReadonly(),
            setProjects: () => undefined,
            setActiveProject: () => undefined,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectCreatePageComponent);
    fixture.detectChanges();
  });

  it('renders shared UI page chrome and form actions', () => {
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

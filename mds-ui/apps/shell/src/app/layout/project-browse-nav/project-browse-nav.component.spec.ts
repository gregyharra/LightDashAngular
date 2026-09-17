import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, RouterLink } from '@angular/router';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import {
  ProjectBrowseNavActive,
  ProjectBrowseNavComponent,
} from './project-browse-nav.component';

@Component({
  selector: 'app-project-browse-nav-host',
  imports: [ProjectBrowseNavComponent],
  template: `
    <div class="page-sidebar">
      <app-project-browse-nav [projectUuid]="projectUuid" [active]="active" />
    </div>
  `,
})
class ProjectBrowseNavHostComponent {
  projectUuid = 'proj-1';
  active: ProjectBrowseNavActive = 'explore';
}

describe('ProjectBrowseNavComponent', () => {
  let fixture: ComponentFixture<ProjectBrowseNavHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectBrowseNavHostComponent],
      providers: [
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'en', lang: 'en' }),
      ],
    }).compileComponents();

    TestBed.inject(TranslateService).setTranslation('en', {
      nav: {
        home: 'Home',
        dashboard: 'Dashboard',
        graph: 'Graph',
        browseNavigation: 'Browse navigation',
      },
      explorer: { title: 'Explore' },
      tables: { title: 'Tables' },
      lineage: { title: 'Lineage' },
    });

    fixture = TestBed.createComponent(ProjectBrowseNavHostComponent);
  });

  it('links home to /projects', () => {
    fixture.detectChanges();

    const home = fixture.debugElement.query(
      By.css('[data-testid="project-browse-nav-home"]'),
    );
    expect(home).toBeTruthy();
    expect(home.injector.get(RouterLink).href).toBe('/projects');
    expect(home.nativeElement.getAttribute('aria-label')).toBe('Home');
  });

  it('renders project browse routerLinks for the given project', () => {
    fixture.detectChanges();

    const hrefs = fixture.debugElement
      .queryAll(By.css('[data-testid="project-browse-nav"] a[data-nav]'))
      .map((el) => el.injector.get(RouterLink).href);

    expect(hrefs).toEqual([
      '/projects/proj-1/explore',
      '/projects/proj-1/dashboards',
      '/projects/proj-1/charts',
      '/projects/proj-1/tables',
      '/projects/proj-1/lineage',
    ]);
  });

  it('marks the active link from the active input', () => {
    fixture.componentInstance.active = 'charts';
    fixture.detectChanges();

    const active = fixture.debugElement.query(
      By.css('.page-sidebar__link--active'),
    );
    expect(active.attributes['data-nav']).toBe('charts');
    expect((active.nativeElement as HTMLElement).textContent).toContain('Graph');
  });
});

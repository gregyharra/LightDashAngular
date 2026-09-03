import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, RouterLink } from '@angular/router';
import {
  DpfProjectSidenavComponent,
  DpfProjectSidenavItem,
} from './project-sidenav.component';

@Component({
  imports: [DpfProjectSidenavComponent],
  template: `
    <dpf-project-sidenav
      [projectUuid]="projectUuid"
      [active]="active"
      [items]="items"
      homeLabel="Projects"
      navigationLabel="Browse project"
    />
  `,
})
class TestHostComponent {
  projectUuid = 'project-1';
  active = 'charts';
  items: readonly DpfProjectSidenavItem[] = [
    { id: 'explore', path: 'explore', icon: 'search', label: 'Explore' },
    { id: 'charts', path: 'charts', icon: 'bar_chart', label: 'Charts' },
  ];
}

describe('DpfProjectSidenavComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
  });

  it('renders a labelled home link to /projects', () => {
    const home = fixture.debugElement.query(
      By.css('[data-testid="project-browse-nav-home"]'),
    );

    expect(home).toBeTruthy();
    expect(home.injector.get(RouterLink).href).toBe('/projects');
    expect(home.nativeElement.getAttribute('aria-label')).toBe('Projects');
  });

  it('marks the active item and builds its project link', () => {
    const active = fixture.debugElement.query(
      By.css('.page-sidebar__link--active'),
    );

    expect(active.attributes['data-nav']).toBe('charts');
    expect(active.injector.get(RouterLink).href).toBe(
      '/projects/project-1/charts',
    );
    expect((active.nativeElement as HTMLElement).textContent).toContain('Charts');
  });
});

import { Routes } from '@angular/router';
import { provideState } from '@ngrx/store';
import { ProjectCreatePageFacade } from './core/facades/project-create-page.facade';
import { ProjectEditPageFacade } from './core/facades/project-edit-page.facade';
import { ProjectsPageFacade } from './core/facades/projects-page.facade';
import { SettingsShellFacade } from './core/facades/settings-shell.facade';
import { projectsFeature } from './core/store/projects.reducer';
import { ProjectCreatePageComponent } from './projects/project-create-page/project-create-page.component';
import { ProjectEditPageComponent } from './projects/project-edit-page/project-edit-page.component';
import { ProjectsPageComponent } from './projects/projects-page/projects-page.component';
import { SettingsShellComponent } from './settings/settings-shell/settings-shell.component';

const projectState = provideState(projectsFeature);

export const PROJECTS_REMOTE_ROUTES: Routes = [
  {
    path: '',
    component: ProjectsPageComponent,
    providers: [projectState, ProjectsPageFacade],
  },
];

export const PROJECTS_MANAGEMENT_REMOTE_ROUTES: Routes = [
  {
    path: '',
    component: ProjectsPageComponent,
    data: { management: true },
    providers: [projectState, ProjectsPageFacade],
  },
];

export const PROJECT_CREATE_REMOTE_ROUTES: Routes = [
  {
    path: '',
    component: ProjectCreatePageComponent,
    providers: [projectState, ProjectCreatePageFacade],
  },
];

export const PROJECT_EDIT_REMOTE_ROUTES: Routes = [
  {
    path: '',
    component: ProjectEditPageComponent,
    providers: [projectState, ProjectEditPageFacade],
  },
];

export { SettingsShellComponent };

export const PROJECTS_STANDALONE_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'projects' },
  {
    path: 'projects',
    children: PROJECTS_REMOTE_ROUTES,
  },
  {
    path: 'settings',
    component: SettingsShellComponent,
    providers: [SettingsShellFacade],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'projects' },
      {
        path: 'projects',
        children: PROJECTS_MANAGEMENT_REMOTE_ROUTES,
      },
      {
        path: 'projects/create',
        children: PROJECT_CREATE_REMOTE_ROUTES,
      },
      {
        path: 'projects/:projectUuid/edit',
        children: PROJECT_EDIT_REMOTE_ROUTES,
      },
    ],
  },
];

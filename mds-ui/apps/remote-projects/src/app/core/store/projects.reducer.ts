import { createFeature, createReducer, on } from '@ngrx/store';
import { ProjectRepoStatus, ProjectSummary, WarehouseListItem } from '@mds-ui/models';
import { ProjectDetail } from '@mds-ui/feature-projects';
import { ProjectsActions } from './projects.actions';

export interface ProjectsState {
  projects: ProjectSummary[];
  project: ProjectDetail | null;
  warehouses: WarehouseListItem[];
  repoStatus: ProjectRepoStatus | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

const initialState: ProjectsState = {
  projects: [],
  project: null,
  warehouses: [],
  repoStatus: null,
  loading: false,
  saving: false,
  error: null,
};

export const projectsFeature = createFeature({
  name: 'remoteProjects',
  reducer: createReducer(
    initialState,
    on(ProjectsActions.loadStarted, (state) => ({
      ...state,
      loading: true,
      error: null,
    })),
    on(ProjectsActions.projectsLoaded, (state, { projects }) => ({
      ...state,
      projects,
      loading: false,
    })),
    on(ProjectsActions.projectLoaded, (state, { project }) => ({
      ...state,
      project,
    })),
    on(ProjectsActions.warehousesLoaded, (state, { warehouses }) => ({
      ...state,
      warehouses,
      loading: false,
    })),
    on(ProjectsActions.repoStatusLoaded, (state, { repoStatus }) => ({
      ...state,
      repoStatus,
    })),
    on(ProjectsActions.saveStarted, (state) => ({
      ...state,
      saving: true,
      error: null,
    })),
    on(ProjectsActions.saveSucceeded, (state, { project }) => ({
      ...state,
      project,
      saving: false,
    })),
    on(ProjectsActions.requestFailed, (state, { message }) => ({
      ...state,
      loading: false,
      saving: false,
      error: message,
    })),
    on(ProjectsActions.errorCleared, (state) => ({
      ...state,
      error: null,
    })),
  ),
});

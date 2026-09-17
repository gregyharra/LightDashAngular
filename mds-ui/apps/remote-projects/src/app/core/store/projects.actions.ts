import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { ProjectRepoStatus, ProjectSummary, WarehouseListItem } from '@mds-ui/models';
import { ProjectDetail } from '@mds-ui/feature-projects';

export const ProjectsActions = createActionGroup({
  source: 'Remote Projects',
  events: {
    'Load Started': emptyProps(),
    'Projects Loaded': props<{ projects: ProjectSummary[] }>(),
    'Project Loaded': props<{ project: ProjectDetail }>(),
    'Warehouses Loaded': props<{ warehouses: WarehouseListItem[] }>(),
    'Repo Status Loaded': props<{ repoStatus: ProjectRepoStatus | null }>(),
    'Save Started': emptyProps(),
    'Save Succeeded': props<{ project: ProjectDetail }>(),
    'Request Failed': props<{ message: string }>(),
    'Error Cleared': emptyProps(),
  },
});

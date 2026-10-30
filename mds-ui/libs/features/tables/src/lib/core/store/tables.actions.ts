import { createActionGroup, emptyProps, props } from '@ngrx/store';
import {
  DbtTreeNode,
  DictionaryEntry,
  DictionaryQuality,
  ModelJoinView,
  ProjectLineage,
} from '@mds-ui/models';

export const TablesActions = createActionGroup({
  source: 'Tables',
  events: {
    'Project Load Started': props<{
      projectUuid: string;
      tableId: string | null;
    }>(),
    'Project Load Succeeded': props<{
      dbtTree: DbtTreeNode[];
      lineage: ProjectLineage;
      quality: DictionaryQuality;
    }>(),
    'Project Load Failed': props<{ error: string }>(),
    'Entry Load Started': props<{ tableId: string }>(),
    'Entry Load Succeeded': props<{ entry: DictionaryEntry }>(),
    'Entry Load Failed': props<{ error: string }>(),
    'Entry Cleared': emptyProps(),
    'Links Load Started': emptyProps(),
    'Links Load Succeeded': props<{ links: ModelJoinView[] }>(),
    'Links Load Failed': emptyProps(),
    'Save Started': emptyProps(),
    'Save Succeeded': props<{ entry?: DictionaryEntry }>(),
    'Save Failed': emptyProps(),
    'Quality Refreshed': props<{ quality: DictionaryQuality }>(),
  },
});

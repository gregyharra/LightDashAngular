import { createFeature, createReducer, on } from '@ngrx/store';
import {
  DbtTreeNode,
  DictionaryEntry,
  DictionaryQuality,
  ModelJoinView,
  ProjectLineage,
} from '@mds-ui/models';
import { TablesActions } from './tables.actions';

export interface TablesState {
  projectUuid: string | null;
  tableId: string | null;
  dbtTree: DbtTreeNode[];
  lineage: ProjectLineage | null;
  quality: DictionaryQuality | null;
  entry: DictionaryEntry | null;
  modelJoins: ModelJoinView[];
  loading: boolean;
  entryLoading: boolean;
  linksLoading: boolean;
  saving: boolean;
  error: string | null;
  entryError: string | null;
}

const initialState: TablesState = {
  projectUuid: null,
  tableId: null,
  dbtTree: [],
  lineage: null,
  quality: null,
  entry: null,
  modelJoins: [],
  loading: false,
  entryLoading: false,
  linksLoading: false,
  saving: false,
  error: null,
  entryError: null,
};

export const tablesFeature = createFeature({
  name: 'tables',
  reducer: createReducer(
    initialState,
    on(TablesActions.projectLoadStarted, (state, { projectUuid, tableId }) => ({
      ...state,
      projectUuid,
      tableId,
      loading: true,
      error: null,
    })),
    on(
      TablesActions.projectLoadSucceeded,
      (state, { dbtTree, lineage, quality }) => ({
        ...state,
        dbtTree,
        lineage,
        quality,
        loading: false,
      }),
    ),
    on(TablesActions.projectLoadFailed, (state, { error }) => ({
      ...state,
      loading: false,
      error,
    })),
    on(TablesActions.entryLoadStarted, (state, { tableId }) => ({
      ...state,
      tableId,
      entryLoading: true,
      error: null,
      entryError: null,
    })),
    on(TablesActions.entryLoadSucceeded, (state, { entry }) => ({
      ...state,
      entry,
      entryLoading: false,
    })),
    on(TablesActions.entryLoadFailed, (state, { error }) => ({
      ...state,
      entry: null,
      entryLoading: false,
      entryError: error,
    })),
    on(TablesActions.entryCleared, (state) => ({
      ...state,
      tableId: null,
      entry: null,
      entryLoading: false,
      error: null,
      entryError: null,
      modelJoins: [],
    })),
    on(TablesActions.linksLoadStarted, (state) => ({
      ...state,
      linksLoading: true,
    })),
    on(TablesActions.linksLoadSucceeded, (state, { links }) => ({
      ...state,
      modelJoins: links,
      linksLoading: false,
    })),
    on(TablesActions.linksLoadFailed, (state) => ({
      ...state,
      modelJoins: [],
      linksLoading: false,
    })),
    on(TablesActions.saveStarted, (state) => ({ ...state, saving: true })),
    on(TablesActions.saveSucceeded, (state, { entry }) => ({
      ...state,
      ...(entry ? { entry } : {}),
      saving: false,
    })),
    on(TablesActions.saveFailed, (state) => ({ ...state, saving: false })),
    on(TablesActions.qualityRefreshed, (state, { quality }) => ({
      ...state,
      quality,
    })),
  ),
});

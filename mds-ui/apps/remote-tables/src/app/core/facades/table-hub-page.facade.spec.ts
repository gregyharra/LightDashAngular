import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { provideStore } from '@ngrx/store';
import { ActiveProjectService } from '@mds-ui/core';
import { LineageService, ModelJoinsService } from '@mds-ui/feature-projects';
import {
  CUSTOM_ATTRIBUTE_DEFS_KEY,
  DictionaryEntry,
  DictionaryQuality,
  LinkDialogSavePayload,
  ProjectLineage,
} from '@mds-ui/models';
import { TranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { DictionaryService } from '../../dictionary.service';
import { tablesFeature } from '../store/tables.reducer';
import { TableHubPageFacade } from './table-hub-page.facade';

describe('TableHubPageFacade', () => {
  const entry = {
    id: 'model.orders',
    name: 'orders',
    type: 'model',
    columns: [],
    custom: {},
  } as DictionaryEntry;
  const quality = {
    score: 100,
    models: { described: 1, total: 1 },
    columns: { described: 0, total: 0 },
  } as DictionaryQuality;
  const lineage = { nodes: [], edges: [], columnEdges: [] } as ProjectLineage;

  const dictionaryService = {
    quality: jest.fn(() => of(quality)),
    get: jest.fn(() => of(entry)),
    updateModel: jest.fn(() => of(entry)),
    updateColumn: jest.fn(() => of(entry)),
  };
  const lineageService = {
    getDbtTree: jest.fn(() => of({ root: [] })),
    getProjectLineage: jest.fn(() => of(lineage)),
  };
  const modelJoinsService = {
    list: jest.fn(() => of([])),
    create: jest.fn(() => of({})),
    update: jest.fn(() => of({})),
    delete: jest.fn(() => of(undefined)),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideStore({ [tablesFeature.name]: tablesFeature.reducer }),
        TableHubPageFacade,
        {
          provide: ActiveProjectService,
          useValue: { setActiveProject: jest.fn() },
        },
        { provide: MatDialog, useValue: { open: jest.fn() } },
        { provide: DictionaryService, useValue: dictionaryService },
        { provide: LineageService, useValue: lineageService },
        { provide: ModelJoinsService, useValue: modelJoinsService },
        {
          provide: TranslateService,
          useValue: { instant: (key: string) => key },
        },
      ],
    });
  });

  it('loads project data and the selected table', () => {
    const facade = TestBed.inject(TableHubPageFacade);

    facade.load('project-1', 'model.orders');

    expect(facade.entry()).toEqual(entry);
    expect(facade.quality()).toEqual(quality);
    expect(facade.loading()).toBe(false);
    expect(facade.entryLoading()).toBe(false);
  });

  it('retries project data after a same-project load failure', () => {
    lineageService.getDbtTree
      .mockReturnValueOnce(throwError(() => new Error('load failed')))
      .mockReturnValueOnce(of({ root: [] }));
    const facade = TestBed.inject(TableHubPageFacade);

    facade.load('project-1', 'model.orders');
    expect(facade.error()).toBe('load failed');

    facade.load('project-1', 'model.orders');

    expect(lineageService.getDbtTree).toHaveBeenCalledTimes(2);
    expect(facade.error()).toBeNull();
    expect(facade.entry()).toEqual(entry);
  });

  it('saves a new attribute definition through the dictionary service', () => {
    const facade = TestBed.inject(TableHubPageFacade);
    facade.load('project-1', 'model.orders');

    facade.addAttribute({ name: 'Owner', type: 'text' });

    expect(dictionaryService.updateModel).toHaveBeenCalledWith(
      'project-1',
      'model.orders',
      expect.objectContaining({
        custom: expect.objectContaining({
          [CUSTOM_ATTRIBUTE_DEFS_KEY]: [
            expect.objectContaining({ name: 'Owner', type: 'text' }),
          ],
        }),
      }),
    );
  });

  it('creates a link and reloads links', () => {
    const facade = TestBed.inject(TableHubPageFacade);
    const onSaved = jest.fn();
    const payload = {
      sourceModelId: 'model.orders',
      sourceColumn: 'customer_id',
      targetModelId: 'model.customers',
      targetColumn: 'id',
    } as LinkDialogSavePayload;
    facade.load('project-1', 'model.orders');
    modelJoinsService.list.mockClear();

    facade.saveLink(payload, onSaved);

    expect(modelJoinsService.create).toHaveBeenCalledWith('project-1', payload);
    expect(modelJoinsService.list).toHaveBeenCalledWith(
      'project-1',
      'model.orders',
    );
    expect(onSaved).toHaveBeenCalled();
  });
});

import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { DictionaryEntry } from '@mds-ui/models';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { TableHubPageFacade } from '../core/facades/table-hub-page.facade';
import { TableHubPageComponent } from './table-hub-page.component';

describe('TableHubPageComponent overview drafts', () => {
  let fixture: ComponentFixture<TableHubPageComponent>;
  const entry = signal<DictionaryEntry | null>(null);
  const saveOverview = jest.fn();
  const facade = {
    projectUuid: signal<string | null>('project-1'),
    tableId: signal<string | null>('model.orders'),
    dbtTree: signal([]),
    lineage: signal(null),
    entry,
    quality: signal(null),
    modelJoins: signal([]),
    loading: signal(false),
    entryLoading: signal(false),
    linksLoading: signal(false),
    saving: signal(false),
    error: signal<string | null>(null),
    entryError: signal<string | null>(null),
    load: jest.fn(),
    loadLinks: jest.fn(),
    selectTable: jest.fn(),
    exploreInCharts: jest.fn(),
    openFullLineage: jest.fn(),
    saveOverview,
    saveColumnDescription: jest.fn(),
    saveColumnAttribute: jest.fn(),
    addAttribute: jest.fn(),
    deleteAttribute: jest.fn(),
    saveLink: jest.fn(),
    deleteLink: jest.fn(),
  };
  const orders = {
    id: 'model.orders',
    name: 'orders',
    type: 'model',
    columns: [],
    descriptionOverride: 'Server description',
    tags: ['server'],
    compiledSql: 'select 1',
    sql: 'select * from source',
  } as DictionaryEntry;

  beforeEach(async () => {
    entry.set(null);
    jest.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [TableHubPageComponent],
      providers: [
        { provide: TableHubPageFacade, useValue: facade },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(
              convertToParamMap({
                projectUuid: 'project-1',
                tableId: 'model.orders',
              }),
            ),
          },
        },
        {
          provide: TranslateService,
          useValue: { instant: (key: string) => key },
        },
      ],
    })
      .overrideComponent(TableHubPageComponent, {
        set: { imports: [], template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(TableHubPageComponent);
  });

  it('preserves unsaved overview and SQL drafts across same-entry updates', () => {
    const component = fixture.componentInstance as unknown as {
      descriptionDraft: ReturnType<typeof signal<string>>;
      tagsDraft: ReturnType<typeof signal<string[]>>;
      sqlViewMode: ReturnType<typeof signal<'compiled' | 'uncompiled'>>;
    };
    entry.set(orders);
    fixture.detectChanges();
    component.descriptionDraft.set('Unsaved description');
    component.tagsDraft.set(['unsaved']);
    component.sqlViewMode.set('uncompiled');

    entry.set({
      ...orders,
      columns: [{ name: 'id', type: 'number' }],
      descriptionOverride: 'Unrelated server update',
      tags: ['updated-server'],
    });
    fixture.detectChanges();

    expect(component.descriptionDraft()).toBe('Unsaved description');
    expect(component.tagsDraft()).toEqual(['unsaved']);
    expect(component.sqlViewMode()).toBe('uncompiled');
  });

  it('resets drafts for another entry and after an overview save', () => {
    const component = fixture.componentInstance as unknown as {
      descriptionDraft: ReturnType<typeof signal<string>>;
      tagsDraft: ReturnType<typeof signal<string[]>>;
      saveOverview(): void;
    };
    entry.set(orders);
    fixture.detectChanges();
    component.descriptionDraft.set('Unsaved description');

    entry.set({
      ...orders,
      id: 'model.customers',
      name: 'customers',
      descriptionOverride: 'Customers description',
      tags: ['customers'],
    });
    fixture.detectChanges();
    expect(component.descriptionDraft()).toBe('Customers description');
    expect(component.tagsDraft()).toEqual(['customers']);

    component.descriptionDraft.set('Saved draft');
    saveOverview.mockImplementationOnce(
      (
        _description: string,
        _tags: string[],
        onSaved: (entry: DictionaryEntry) => void,
      ) => {
        const updatedEntry = {
          ...orders,
          id: 'model.customers',
          name: 'customers',
          descriptionOverride: 'Normalized saved draft',
          tags: ['normalized'],
        } as DictionaryEntry;
        entry.set(updatedEntry);
        onSaved(updatedEntry);
      },
    );
    component.saveOverview();

    expect(component.descriptionDraft()).toBe('Normalized saved draft');
    expect(component.tagsDraft()).toEqual(['normalized']);
  });
});

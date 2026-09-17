import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { ActiveProjectService, apiErrorMessage } from '@mds-ui/core';
import { LineageService, ModelJoinsService } from '@mds-ui/feature-projects';
import {
  CUSTOM_ATTRIBUTE_DEFS_KEY,
  CustomAttributeDef,
  CustomAttributeType,
  DictionaryEntry,
  LinkDialogSavePayload,
  ModelJoinView,
} from '@mds-ui/models';
import { ConfirmDialogComponent } from '@mds-ui/shared';
import { TranslateService } from '@ngx-translate/core';
import { Observable, forkJoin, of } from 'rxjs';
import { DictionaryService } from '../../dictionary.service';
import { TablesActions } from '../store/tables.actions';
import { tablesFeature } from '../store/tables.reducer';

export type NewAttributeDefinition = {
  name: string;
  type: CustomAttributeType;
  options?: string[];
};

@Injectable()
export class TableHubPageFacade {
  private readonly store = inject(Store);
  private readonly dictionaryService = inject(DictionaryService);
  private readonly modelJoinsService = inject(ModelJoinsService);
  private readonly lineageService = inject(LineageService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly activeProjectService = inject(ActiveProjectService);

  readonly projectUuid = this.store.selectSignal(tablesFeature.selectProjectUuid);
  readonly tableId = this.store.selectSignal(tablesFeature.selectTableId);
  readonly dbtTree = this.store.selectSignal(tablesFeature.selectDbtTree);
  readonly lineage = this.store.selectSignal(tablesFeature.selectLineage);
  readonly quality = this.store.selectSignal(tablesFeature.selectQuality);
  readonly entry = this.store.selectSignal(tablesFeature.selectEntry);
  readonly modelJoins = this.store.selectSignal(tablesFeature.selectModelJoins);
  readonly loading = this.store.selectSignal(tablesFeature.selectLoading);
  readonly entryLoading = this.store.selectSignal(tablesFeature.selectEntryLoading);
  readonly linksLoading = this.store.selectSignal(tablesFeature.selectLinksLoading);
  readonly saving = this.store.selectSignal(tablesFeature.selectSaving);
  readonly error = this.store.selectSignal(tablesFeature.selectError);
  readonly entryError = this.store.selectSignal(tablesFeature.selectEntryError);

  private loadedProjectUuid: string | null = null;
  private linksLoadGeneration = 0;

  load(projectUuid: string, tableId: string | null): void {
    this.activeProjectService.setActiveProject(projectUuid);
    if (this.loadedProjectUuid === projectUuid) {
      this.loadEntry(projectUuid, tableId);
      return;
    }

    this.store.dispatch(
      TablesActions.projectLoadStarted({ projectUuid, tableId }),
    );
    forkJoin({
      tree: this.lineageService.getDbtTree(projectUuid),
      lineage: this.lineageService.getProjectLineage(projectUuid),
      quality: this.dictionaryService.quality(projectUuid),
    }).subscribe({
      next: ({ tree, lineage, quality }) => {
        this.loadedProjectUuid = projectUuid;
        this.store.dispatch(
          TablesActions.projectLoadSucceeded({
            dbtTree: tree.root,
            lineage,
            quality,
          }),
        );
        this.loadEntry(projectUuid, tableId);
      },
      error: (error) =>
        this.store.dispatch(
          TablesActions.projectLoadFailed({
            error: apiErrorMessage(
              error,
              this.translate.instant('tables.loadError'),
            ),
          }),
        ),
    });
  }

  loadLinks(): void {
    const projectUuid = this.projectUuid();
    const sourceModelId = this.entry()?.id ?? this.tableId();
    if (!projectUuid || !sourceModelId) {
      this.store.dispatch(TablesActions.linksLoadSucceeded({ links: [] }));
      return;
    }

    const generation = ++this.linksLoadGeneration;
    this.store.dispatch(TablesActions.linksLoadStarted());
    this.modelJoinsService.list(projectUuid, sourceModelId).subscribe({
      next: (links) => {
        if (generation === this.linksLoadGeneration) {
          this.store.dispatch(TablesActions.linksLoadSucceeded({ links }));
        }
      },
      error: () => {
        if (generation === this.linksLoadGeneration) {
          this.store.dispatch(TablesActions.linksLoadFailed());
        }
      },
    });
  }

  selectTable(lineageNodeId: string): void {
    const projectUuid = this.projectUuid();
    if (projectUuid) {
      void this.router.navigate([
        '/projects',
        projectUuid,
        'tables',
        lineageNodeId,
      ]);
    }
  }

  exploreInCharts(): void {
    const projectUuid = this.projectUuid();
    const tableId = this.tableId();
    if (projectUuid && tableId) {
      void this.router.navigate([
        '/projects',
        projectUuid,
        'explore',
        tableId,
      ]);
    }
  }

  openFullLineage(): void {
    const projectUuid = this.projectUuid();
    if (projectUuid) {
      void this.router.navigate(['/projects', projectUuid, 'lineage'], {
        queryParams: this.tableId() ? { node: this.tableId() } : {},
      });
    }
  }

  saveOverview(
    descriptionOverride: string,
    tags: string[],
    onSaved?: (entry: DictionaryEntry) => void,
  ): void {
    const context = this.currentEntryContext();
    if (!context) return;
    this.saveEntry(
      this.dictionaryService.updateModel(context.projectUuid, context.entry.id, {
        descriptionOverride,
        tags,
      }),
      true,
      true,
      onSaved,
    );
  }

  saveColumnDescription(columnName: string, descriptionOverride: string): void {
    const context = this.currentEntryContext();
    if (!context) return;
    this.saveEntry(
      this.dictionaryService.updateColumn(
        context.projectUuid,
        context.entry.id,
        columnName,
        { descriptionOverride },
      ),
      true,
    );
  }

  saveColumnAttribute(columnName: string, attrId: string, value: unknown): void {
    const context = this.currentEntryContext();
    const column = context?.entry.columns.find((item) => item.name === columnName);
    if (!context || !column) return;

    const custom = { ...(column.custom ?? {}) };
    if (value === null || value === undefined) delete custom[attrId];
    else custom[attrId] = value;
    this.saveEntry(
      this.dictionaryService.updateColumn(
        context.projectUuid,
        context.entry.id,
        columnName,
        { custom },
      ),
      true,
    );
  }

  addAttribute(result: NewAttributeDefinition): void {
    const context = this.currentEntryContext();
    if (!context) return;
    const definition: CustomAttributeDef = {
      id: this.generateAttributeId(),
      name: result.name,
      type: result.type,
      ...(result.type === 'enum' ? { options: result.options ?? [] } : {}),
    };
    const custom = {
      ...(context.entry.custom ?? {}),
      [CUSTOM_ATTRIBUTE_DEFS_KEY]: [
        ...this.attributeDefinitions(context.entry),
        definition,
      ],
    };
    this.saveEntry(
      this.dictionaryService.updateModel(
        context.projectUuid,
        context.entry.id,
        { custom },
      ),
    );
  }

  deleteAttribute(definition: CustomAttributeDef): void {
    const context = this.currentEntryContext();
    if (!context) return;
    const custom = {
      ...(context.entry.custom ?? {}),
      [CUSTOM_ATTRIBUTE_DEFS_KEY]: this.attributeDefinitions(
        context.entry,
      ).filter((item) => item.id !== definition.id),
    };
    const cleanups = context.entry.columns
      .filter((column) =>
        Object.prototype.hasOwnProperty.call(column.custom ?? {}, definition.id),
      )
      .map((column) => {
        const columnCustom = { ...(column.custom ?? {}) };
        delete columnCustom[definition.id];
        return this.dictionaryService.updateColumn(
          context.projectUuid,
          context.entry.id,
          column.name,
          { custom: columnCustom },
        );
      });

    const cleanup$: Observable<unknown> = cleanups.length
      ? forkJoin(cleanups)
      : of(null);
    this.store.dispatch(TablesActions.saveStarted());
    cleanup$.subscribe({
      next: () =>
        this.saveEntry(
          this.dictionaryService.updateModel(
            context.projectUuid,
            context.entry.id,
            { custom },
          ),
          true,
          false,
        ),
      error: () => this.store.dispatch(TablesActions.saveFailed()),
    });
  }

  saveLink(payload: LinkDialogSavePayload, onSaved?: () => void): void {
    const projectUuid = this.projectUuid();
    if (!projectUuid) return;
    this.store.dispatch(TablesActions.saveStarted());
    const request$ = payload.uuid
      ? this.modelJoinsService.update(projectUuid, payload.uuid, payload)
      : this.modelJoinsService.create(projectUuid, payload);
    request$.subscribe({
      next: () => {
        this.store.dispatch(TablesActions.saveSucceeded({}));
        this.loadLinks();
        onSaved?.();
      },
      error: () => this.store.dispatch(TablesActions.saveFailed()),
    });
  }

  deleteLink(link: ModelJoinView): void {
    const projectUuid = this.projectUuid();
    const linkUuid = link.uuid;
    if (!projectUuid || !linkUuid) return;
    this.dialog
      .open(ConfirmDialogComponent, {
        width: '28rem',
        data: {
          title: this.translate.instant('tables.links.deleteTitle'),
          message: this.translate.instant('tables.links.deleteMessage', {
            source: `${link.sourceModelName}.${link.sourceColumn}`,
            target: `${link.targetModelName}.${link.targetColumn}`,
          }),
          confirmLabel: this.translate.instant('common.delete'),
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.store.dispatch(TablesActions.saveStarted());
        this.modelJoinsService.delete(projectUuid, linkUuid).subscribe({
          next: () => {
            this.store.dispatch(TablesActions.saveSucceeded({}));
            this.loadLinks();
          },
          error: () => this.store.dispatch(TablesActions.saveFailed()),
        });
      });
  }

  private loadEntry(projectUuid: string, tableId: string | null): void {
    if (!tableId) {
      this.store.dispatch(TablesActions.entryCleared());
      return;
    }
    this.store.dispatch(TablesActions.entryLoadStarted({ tableId }));
    this.dictionaryService.get(projectUuid, tableId).subscribe({
      next: (entry) => {
        this.store.dispatch(TablesActions.entryLoadSucceeded({ entry }));
        this.loadLinks();
      },
      error: (error) =>
        this.store.dispatch(
          TablesActions.entryLoadFailed({
            error: apiErrorMessage(
              error,
              this.translate.instant('tables.detailsLoadError'),
            ),
          }),
        ),
    });
  }

  private saveEntry(
    request$: Observable<DictionaryEntry>,
    refreshQuality = false,
    dispatchStarted = true,
    onSaved?: (entry: DictionaryEntry) => void,
  ): void {
    if (dispatchStarted) this.store.dispatch(TablesActions.saveStarted());
    request$.subscribe({
      next: (entry) => {
        this.store.dispatch(TablesActions.saveSucceeded({ entry }));
        onSaved?.(entry);
        if (refreshQuality) this.refreshQuality();
      },
      error: () => this.store.dispatch(TablesActions.saveFailed()),
    });
  }

  private refreshQuality(): void {
    const projectUuid = this.projectUuid();
    if (!projectUuid) return;
    this.dictionaryService.quality(projectUuid).subscribe({
      next: (quality) =>
        this.store.dispatch(TablesActions.qualityRefreshed({ quality })),
    });
  }

  private currentEntryContext():
    | { projectUuid: string; entry: DictionaryEntry }
    | undefined {
    const projectUuid = this.projectUuid();
    const entry = this.entry();
    return projectUuid && entry ? { projectUuid, entry } : undefined;
  }

  private attributeDefinitions(entry: DictionaryEntry): CustomAttributeDef[] {
    const value = entry.custom?.[CUSTOM_ATTRIBUTE_DEFS_KEY];
    return Array.isArray(value) ? (value as CustomAttributeDef[]) : [];
  }

  private generateAttributeId(): string {
    return globalThis.crypto?.randomUUID?.() ??
      `attr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

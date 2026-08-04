import { Component, ElementRef, inject, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  DashboardTab,
  DashboardTile,
  DashboardTileTypes,
} from '../../../core/models/dashboard.model';
import { isValidLoomUrl } from '../dashboard-loom.utils';

export type DashboardTileSettingsDialogData = {
  tile: DashboardTile;
  tabs?: DashboardTab[];
};

export type DashboardTileSettingsDialogResult = {
  tile: DashboardTile;
  moveToTabUuid?: string;
} | undefined;

@Component({
  selector: 'app-dashboard-tile-settings-dialog',
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatTooltipModule,
  ],
  templateUrl: './dashboard-tile-settings-dialog.component.html',
  styleUrl: './dashboard-tile-settings-dialog.component.scss',
})
export class DashboardTileSettingsDialogComponent {
  private readonly dialogRef = inject(
    MatDialogRef<
      DashboardTileSettingsDialogComponent,
      DashboardTileSettingsDialogResult
    >,
  );
  readonly data = inject<DashboardTileSettingsDialogData>(MAT_DIALOG_DATA);
  private readonly markdownContent =
    viewChild<ElementRef<HTMLTextAreaElement>>('markdownContent');

  protected tile: DashboardTile = structuredClone(this.data.tile);
  protected moveToTabUuid = this.tile.tabUuid ?? '';
  protected readonly DashboardTileTypes = DashboardTileTypes;
  protected readonly tabs = this.data.tabs ?? [];

  protected get dialogTitle(): string {
    switch (this.tile.type) {
      case DashboardTileTypes.HEADING:
        return 'Edit heading tile';
      case DashboardTileTypes.MARKDOWN:
        return 'Edit markdown tile';
      case DashboardTileTypes.SAVED_CHART:
        return 'Edit chart tile';
      case DashboardTileTypes.LOOM:
        return 'Edit loom tile';
      case DashboardTileTypes.SQL_CHART:
        return 'Edit SQL chart tile';
      default:
        return 'Edit tile';
    }
  }

  protected get loomUrlError(): string | null {
    if (this.tile.type !== DashboardTileTypes.LOOM) {
      return null;
    }

    const url = this.tile.properties.url?.trim();
    if (!url) {
      return 'Loom URL is required';
    }

    return isValidLoomUrl(url) ? null : 'Enter a valid Loom share URL';
  }

  protected get canSave(): boolean {
    if (this.tile.type === DashboardTileTypes.LOOM) {
      return (
        !!this.tile.properties.title?.trim() &&
        !!this.tile.properties.url?.trim() &&
        !this.loomUrlError
      );
    }

    if (this.tile.type === DashboardTileTypes.HEADING) {
      return !!this.tile.properties.text?.trim();
    }

    return true;
  }

  protected updateProperty(key: string, value: unknown): void {
    this.tile = {
      ...this.tile,
      properties: {
        ...this.tile.properties,
        [key]: value,
      },
    } as DashboardTile;
  }

  protected wrapMarkdownSelection(before: string, after: string): void {
    this.mutateMarkdownSelection((value, start, end) => {
      const selected = value.slice(start, end) || 'text';
      return {
        next: `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`,
        cursorStart: start + before.length,
        cursorEnd: start + before.length + selected.length,
      };
    });
  }

  protected prefixMarkdownSelection(prefix: string): void {
    this.mutateMarkdownSelection((value, start, end) => {
      const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
      const selected = value.slice(start, end) || 'text';
      const nextSelected = selected.includes('\n')
        ? selected
            .split('\n')
            .map((line) => (line.startsWith(prefix) ? line : `${prefix}${line}`))
            .join('\n')
        : selected.startsWith(prefix)
          ? selected
          : `${prefix}${selected}`;

      if (start === end && !value.slice(lineStart, start).trim()) {
        return {
          next: `${value.slice(0, lineStart)}${prefix}${value.slice(lineStart)}`,
          cursorStart: start + prefix.length,
          cursorEnd: start + prefix.length,
        };
      }

      return {
        next: `${value.slice(0, start)}${nextSelected}${value.slice(end)}`,
        cursorStart: start,
        cursorEnd: start + nextSelected.length,
      };
    });
  }

  protected insertMarkdownLink(): void {
    this.mutateMarkdownSelection((value, start, end) => {
      const selected = value.slice(start, end) || 'label';
      const snippet = `[${selected}](https://)`;
      return {
        next: `${value.slice(0, start)}${snippet}${value.slice(end)}`,
        cursorStart: start + selected.length + 3,
        cursorEnd: start + snippet.length - 1,
      };
    });
  }

  protected insertMarkdownSnippet(snippet: string): void {
    this.mutateMarkdownSelection((value, start, end) => ({
      next: `${value.slice(0, start)}${snippet}${value.slice(end)}`,
      cursorStart: start + snippet.length,
      cursorEnd: start + snippet.length,
    }));
  }

  private mutateMarkdownSelection(
    mutate: (
      value: string,
      start: number,
      end: number,
    ) => { next: string; cursorStart: number; cursorEnd: number },
  ): void {
    if (this.tile.type !== DashboardTileTypes.MARKDOWN) {
      return;
    }

    const textarea = this.markdownContent()?.nativeElement;
    const value = this.tile.properties.content ?? '';
    const start = textarea?.selectionStart ?? value.length;
    const end = textarea?.selectionEnd ?? value.length;
    const result = mutate(value, start, end);

    this.updateProperty('content', result.next);

    queueMicrotask(() => {
      const nextTextarea = this.markdownContent()?.nativeElement;
      if (!nextTextarea) {
        return;
      }
      nextTextarea.focus();
      nextTextarea.setSelectionRange(result.cursorStart, result.cursorEnd);
    });
  }

  protected save(): void {
    if (!this.canSave) {
      return;
    }

    const moveToTabUuid =
      this.moveToTabUuid && this.moveToTabUuid !== this.tile.tabUuid
        ? this.moveToTabUuid
        : undefined;

    this.dialogRef.close({ tile: this.tile, moveToTabUuid });
  }

  protected cancel(): void {
    this.dialogRef.close(undefined);
  }
}

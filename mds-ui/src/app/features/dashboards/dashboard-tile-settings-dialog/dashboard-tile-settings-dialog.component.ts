import { Component, inject } from '@angular/core';
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

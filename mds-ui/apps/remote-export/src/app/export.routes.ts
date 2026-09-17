import { Routes } from '@angular/router';
import { ExportDialogComponent } from '@mds-ui/feature-export';
import { ExportDialogFacade } from './core/facades/export-dialog.facade';

export const EXPORT_REMOTE_ROUTES: Routes = [
  { path: '', component: ExportDialogComponent, providers: [ExportDialogFacade] },
];
export { ExportDialogComponent, startExport } from '@mds-ui/feature-export';

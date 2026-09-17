import { Injectable, inject } from '@angular/core';
import { ExportService, startExport } from '@mds-ui/feature-export';

@Injectable()
export class ExportDialogFacade {
  private readonly exportService = inject(ExportService);
  startExport = startExport;
  readonly api = this.exportService;
}

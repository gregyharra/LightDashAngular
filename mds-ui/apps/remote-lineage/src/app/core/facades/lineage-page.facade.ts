import { Injectable, inject } from '@angular/core';
import { LineageService } from '@mds-ui/core';

@Injectable()
export class LineagePageFacade {
  private readonly lineage = inject(LineageService);
  readonly api = this.lineage;
}

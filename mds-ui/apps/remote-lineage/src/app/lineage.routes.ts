import { Routes } from '@angular/router';
import { LineagePageComponent } from './lineage/lineage-page/lineage-page.component';
import { LineagePageFacade } from './core/facades/lineage-page.facade';

export const LINEAGE_REMOTE_ROUTES: Routes = [
  { path: '', component: LineagePageComponent, providers: [LineagePageFacade] },
];

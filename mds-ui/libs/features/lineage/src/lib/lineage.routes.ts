import { Routes } from '@angular/router';
import { provideFeatureTranslations } from '@mds-ui/core';
import { LineagePageComponent } from './lineage/lineage-page/lineage-page.component';
import { LineagePageFacade } from './core/facades/lineage-page.facade';

export const LINEAGE_REMOTE_ROUTES: Routes = [
  { path: '', component: LineagePageComponent, providers: [...provideFeatureTranslations('lineage'), LineagePageFacade] },
];

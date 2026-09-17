import { Routes } from '@angular/router';
import { provideState } from '@ngrx/store';
import { TableHubPageFacade } from './core/facades/table-hub-page.facade';
import { tablesFeature } from './core/store/tables.reducer';
import { TableHubPageComponent } from './table-hub-page/table-hub-page.component';

export const TABLES_REMOTE_ROUTES: Routes = [
  {
    path: '',
    component: TableHubPageComponent,
    providers: [provideState(tablesFeature), TableHubPageFacade],
  },
];

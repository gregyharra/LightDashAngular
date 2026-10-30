import { Routes } from '@angular/router';
import { ExplorerPageComponent } from './explorer/explorer-page/explorer-page.component';
import { ExplorerPageFacade } from './core/facades/explorer-page.facade';
import { TablesWorkspacePageFacade } from './core/facades/tables-workspace-page.facade';

export const EXPLORER_REMOTE_ROUTES: Routes = [
  {
    path: '',
    component: ExplorerPageComponent,
    providers: [ExplorerPageFacade, TablesWorkspacePageFacade],
  },
  {
    path: ':tableId',
    component: ExplorerPageComponent,
    providers: [ExplorerPageFacade, TablesWorkspacePageFacade],
  },
];

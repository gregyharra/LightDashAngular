import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { WarehouseListItem } from '@mds-ui/models';

export const WarehousesActions = createActionGroup({
  source: 'Warehouses',
  events: {
    'Load Started': emptyProps(),
    'Load Succeeded': props<{ warehouses: WarehouseListItem[] }>(),
    'Load Failed': props<{ error: string }>(),
    'Delete Started': props<{ warehouseUuid: string }>(),
    'Delete Succeeded': props<{ warehouseUuid: string }>(),
    'Delete Failed': props<{ error: string }>(),
  },
});

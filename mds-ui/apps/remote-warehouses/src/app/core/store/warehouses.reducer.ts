import { createFeature, createReducer, on } from '@ngrx/store';
import { WarehouseListItem } from '@mds-ui/models';
import { WarehousesActions } from './warehouses.actions';

export interface WarehousesState {
  warehouses: WarehouseListItem[];
  loading: boolean;
  error: string | null;
  deletingUuid: string | null;
}

const initialState: WarehousesState = {
  warehouses: [],
  loading: true,
  error: null,
  deletingUuid: null,
};

export const warehousesFeature = createFeature({
  name: 'warehouses',
  reducer: createReducer(
    initialState,
    on(WarehousesActions.loadStarted, (state) => ({
      ...state,
      loading: true,
      error: null,
    })),
    on(WarehousesActions.loadSucceeded, (state, { warehouses }) => ({
      ...state,
      warehouses,
      loading: false,
    })),
    on(WarehousesActions.loadFailed, (state, { error }) => ({
      ...state,
      loading: false,
      error,
    })),
    on(WarehousesActions.deleteStarted, (state, { warehouseUuid }) => ({
      ...state,
      deletingUuid: warehouseUuid,
      error: null,
    })),
    on(WarehousesActions.deleteSucceeded, (state, { warehouseUuid }) => ({
      ...state,
      warehouses: state.warehouses.filter(
        (warehouse) => warehouse.warehouseUuid !== warehouseUuid,
      ),
      deletingUuid: null,
    })),
    on(WarehousesActions.deleteFailed, (state, { error }) => ({
      ...state,
      deletingUuid: null,
      error,
    })),
  ),
});

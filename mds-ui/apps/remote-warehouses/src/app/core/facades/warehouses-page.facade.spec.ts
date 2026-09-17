import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideStore } from '@ngrx/store';
import { ApiErrorService } from '@mds-ui/core';
import { WarehouseService } from '@mds-ui/feature-warehouses';
import { WarehouseListItem } from '@mds-ui/models';
import { TranslateService } from '@ngx-translate/core';
import { Observable, of, throwError } from 'rxjs';
import { WarehousesPageFacade } from './warehouses-page.facade';
import { warehousesFeature } from '../store/warehouses.reducer';

describe('WarehousesPageFacade', () => {
  const warehouse = {
    warehouseUuid: 'w1',
    name: 'Analytics',
  } as WarehouseListItem;

  function configure(
    deleteWarehouse: () => Observable<unknown> = () => of(undefined),
  ): ApiErrorService {
    const apiErrorService = {
      showTransient: jest.fn(() => 'delete failed'),
    } as unknown as ApiErrorService;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideStore({
          [warehousesFeature.name]: warehousesFeature.reducer,
        }),
        WarehousesPageFacade,
        {
          provide: ApiErrorService,
          useValue: apiErrorService,
        },
        {
          provide: TranslateService,
          useValue: { instant: (key: string) => key },
        },
        {
          provide: WarehouseService,
          useValue: {
            list: () => of([warehouse]),
            delete: deleteWarehouse,
          },
        },
      ],
    });
    return apiErrorService;
  }

  it('load() populates warehouses', () => {
    configure();

    const facade = TestBed.inject(WarehousesPageFacade);
    facade.load();

    expect(facade.warehouses()).toEqual([warehouse]);
    expect(facade.loading()).toBe(false);
  });

  it('removes a warehouse after a successful delete', () => {
    const deleteWarehouse = jest.fn(() => of(undefined));
    configure(deleteWarehouse);
    const facade = TestBed.inject(WarehousesPageFacade);
    facade.load();

    facade.delete('w1');

    expect(deleteWarehouse).toHaveBeenCalledWith('w1');
    expect(facade.warehouses()).toEqual([]);
    expect(facade.deletingUuid()).toBeNull();
    expect(facade.error()).toBeNull();
  });

  it('keeps the warehouse and exposes the error after a failed delete', () => {
    configure(() => throwError(() => new Error('network')));
    const facade = TestBed.inject(WarehousesPageFacade);
    facade.load();

    facade.delete('w1');

    expect(facade.warehouses()).toEqual([warehouse]);
    expect(facade.deletingUuid()).toBeNull();
    expect(facade.error()).toBe('delete failed');
  });
});

import { By } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideRouter } from '@angular/router';
import { provideStore } from '@ngrx/store';
import { provideTranslateService } from '@ngx-translate/core';
import { Warehouse } from '@mds-ui/models';
import {
  WarehouseFormComponent,
  WarehouseService,
} from '@mds-ui/feature-warehouses';
import { of } from 'rxjs';
import { WarehouseEditPageFacade } from '../core/facades/warehouse-edit-page.facade';
import { WAREHOUSES_REMOTE_ROUTES } from '../warehouses.routes';
import { WarehouseEditPageComponent } from './warehouse-edit-page.component';

describe('WarehouseEditPageComponent', () => {
  it('uses the component route parameter to load edit mode warehouse data', async () => {
    const warehouse = {
      warehouseUuid: 'w1',
      name: 'Analytics',
      type: 'trino',
      host: 'localhost',
      port: 8080,
      catalog: 'analytics',
      schema: 'public',
      user: 'dbt',
      hasPassword: true,
      ssl: false,
      extraConfig: {},
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    } satisfies Warehouse;
    const get = jest.fn(() => of(warehouse));

    await TestBed.configureTestingModule({
      providers: [
        provideRouter(WAREHOUSES_REMOTE_ROUTES),
        provideStore(),
        provideTranslateService({ fallbackLang: 'en', lang: 'en' }),
        {
          provide: WarehouseService,
          useValue: { get },
        },
      ],
    }).compileComponents();

    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl(
      '/w1/edit',
      WarehouseEditPageComponent,
    );
    harness.detectChanges();

    const routeDebugElement = harness.routeDebugElement;
    if (!routeDebugElement) {
      throw new Error('Expected the warehouse edit route to be active');
    }
    const facade = routeDebugElement.injector.get(WarehouseEditPageFacade);
    const form = routeDebugElement.query(
      By.directive(WarehouseFormComponent),
    ).componentInstance as WarehouseFormComponent;

    expect(component).toBeTruthy();
    expect(facade.warehouseUuid()).toBe('w1');
    expect(facade.isCreateMode()).toBe(false);
    expect(form.mode()).toBe('edit');
    expect(form.warehouseUuid()).toBe('w1');
    expect(get).toHaveBeenCalledWith('w1');
    expect((form as unknown as { name: string }).name).toBe('Analytics');
  });
});

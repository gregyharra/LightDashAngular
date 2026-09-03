import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { WarehouseService } from '../../projects/warehouse.service';
import { WarehouseEditPageComponent } from './warehouse-edit-page.component';

describe('WarehouseEditPageComponent', () => {
  let fixture: ComponentFixture<WarehouseEditPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WarehouseEditPageComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'en', lang: 'en' }),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ warehouseUuid: null })),
          },
        },
        {
          provide: WarehouseService,
          useValue: {},
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WarehouseEditPageComponent);
    fixture.detectChanges();
  });

  it('renders the warehouse form inside design-system page chrome', () => {
    expect(fixture.debugElement.query(By.css('ld-page-frame'))).toBeTruthy();
    expect(fixture.debugElement.query(By.css('ld-page-header'))).toBeTruthy();
    expect(
      fixture.debugElement.query(By.css('app-warehouse-form')),
    ).toBeTruthy();
  });
});

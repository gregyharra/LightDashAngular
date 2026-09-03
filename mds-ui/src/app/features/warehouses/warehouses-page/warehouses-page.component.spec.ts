import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { ApiErrorService } from '../../../core/api/api-error.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { WarehouseService } from '../../projects/warehouse.service';
import { WarehousesPageComponent } from './warehouses-page.component';

describe('WarehousesPageComponent', () => {
  let fixture: ComponentFixture<WarehousesPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WarehousesPageComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'en', lang: 'en' }),
        {
          provide: WarehouseService,
          useValue: { list: () => of([]) },
        },
        {
          provide: ApiErrorService,
          useValue: { showTransient: (_error: unknown, message: string) => message },
        },
        {
          provide: LanguageService,
          useValue: { formatDate: () => 'Jan 1, 2024' },
        },
      ],
    }).compileComponents();

    TestBed.inject(TranslateService).setTranslation('en', {
      warehouses: {
        title: 'Warehouses',
        subtitle: 'Manage warehouse connections.',
        create: 'Create warehouse',
        createFirst: 'Create your first warehouse',
        empty: 'No warehouses.',
      },
    });

    fixture = TestBed.createComponent(WarehousesPageComponent);
    fixture.detectChanges();
  });

  it('renders the shared UI page header and create action when loaded', () => {
    const header = fixture.debugElement.query(By.css('dpf-page-header'));

    expect(header).toBeTruthy();
    expect((header?.nativeElement as HTMLElement | undefined)?.textContent).toContain('Warehouses');
    expect(
      fixture.debugElement.query(By.css('dpf-page-header dpf-button[dpfActions]')),
    ).toBeTruthy();
  });

  it('adds page spacing below the shared UI header', () => {
    const header = fixture.debugElement.query(By.css('dpf-page-header'));

    expect(getComputedStyle(header.nativeElement).marginBottom).toBe('24px');
  });
});

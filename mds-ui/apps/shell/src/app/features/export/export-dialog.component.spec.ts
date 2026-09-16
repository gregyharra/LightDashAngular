import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import {
  MAT_DIALOG_DATA,
  MatDialogRef,
} from '@angular/material/dialog';
import {
  provideTranslateService,
  TranslateService,
} from '@ngx-translate/core';
import {
  ExportDialogComponent,
  ExportDialogData,
} from './export-dialog.component';
import { LanguageService } from '../../core/i18n/language.service';

describe('ExportDialogComponent', () => {
  let fixture: ComponentFixture<ExportDialogComponent>;
  let dialogRef: jasmine.SpyObj<
    MatDialogRef<ExportDialogComponent, { overrideRowCap: boolean } | undefined>
  >;
  let languageService: jasmine.SpyObj<LanguageService>;

  const dialogData: ExportDialogData = {
    format: 'csv',
    csvMaxLimit: 5_000_000,
    filenameBase: 'orders',
  };

  beforeEach(async () => {
    dialogRef = jasmine.createSpyObj('MatDialogRef', ['close']);
    languageService = jasmine.createSpyObj('LanguageService', ['formatNumber']);
    languageService.formatNumber.and.returnValue('5\u202f000\u202f000');

    await TestBed.configureTestingModule({
      imports: [ExportDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: dialogData },
        { provide: LanguageService, useValue: languageService },
        provideTranslateService(),
      ],
    }).compileComponents();

    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', {
      common: { cancel: 'Cancel' },
      export: {
        action: 'Export',
        allRows: 'Export all rows',
        dialog: {
          title: 'Export {{format}}',
          limit: 'Exports are limited to the first {{count}} rows.',
          warning: 'This can be slow and heavy on the warehouse.',
        },
      },
    });
    translate.use('en');

    fixture = TestBed.createComponent(ExportDialogComponent);
    fixture.detectChanges();
  });

  it('formats csvMaxLimit with the LanguageService locale', () => {
    expect(fixture.componentInstance).toBeTruthy();
    expect(languageService.formatNumber).toHaveBeenCalledWith(5_000_000);
    expect(fixture.nativeElement.textContent).toContain('5\u202f000\u202f000');
  });

  it('confirmCapped closes with overrideRowCap false', () => {
    fixture.componentInstance.confirmCapped();
    expect(dialogRef.close).toHaveBeenCalledWith({ overrideRowCap: false });
  });

  it('confirmOverride closes with overrideRowCap true', () => {
    fixture.componentInstance.confirmOverride();
    expect(dialogRef.close).toHaveBeenCalledWith({ overrideRowCap: true });
  });

  it('shows override warning before confirming export all rows', () => {
    const exportAllButton = fixture.debugElement.query(
      By.css('[data-testid="export-all-rows"]'),
    );
    expect(exportAllButton).not.toBeNull();
    exportAllButton.nativeElement.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'This can be slow and heavy on the warehouse.',
    );
  });
});

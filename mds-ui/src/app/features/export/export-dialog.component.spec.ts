import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import {
  MAT_DIALOG_DATA,
  MatDialogRef,
} from '@angular/material/dialog';
import {
  ExportDialogComponent,
  ExportDialogData,
} from './export-dialog.component';

describe('ExportDialogComponent', () => {
  let fixture: ComponentFixture<ExportDialogComponent>;
  let dialogRef: jasmine.SpyObj<
    MatDialogRef<ExportDialogComponent, { overrideRowCap: boolean } | undefined>
  >;

  const dialogData: ExportDialogData = {
    format: 'csv',
    csvMaxLimit: 5_000_000,
    filenameBase: 'orders',
  };

  beforeEach(async () => {
    dialogRef = jasmine.createSpyObj('MatDialogRef', ['close']);

    await TestBed.configureTestingModule({
      imports: [ExportDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: dialogData },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExportDialogComponent);
    fixture.detectChanges();
  });

  it('creates with csvMaxLimit from dialog data', () => {
    expect(fixture.componentInstance).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('5,000,000');
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

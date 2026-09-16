import { ComponentFixture, TestBed } from '@angular/core/testing';
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
  ConfirmDialogComponent,
  ConfirmDialogData,
} from './confirm-dialog.component';

describe('ConfirmDialogComponent', () => {
  let fixture: ComponentFixture<ConfirmDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfirmDialogComponent, NoopAnimationsModule],
      providers: [
        provideTranslateService({ fallbackLang: 'en', lang: 'fr' }),
        {
          provide: MatDialogRef,
          useValue: jasmine.createSpyObj('MatDialogRef', ['close']),
        },
        {
          provide: MAT_DIALOG_DATA,
          useValue: { message: 'Delete this item?' } satisfies ConfirmDialogData,
        },
      ],
    }).compileComponents();

    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('fr', {
      common: {
        confirm: 'Confirmer',
        cancel: 'Annuler',
        delete: 'Supprimer',
      },
    });
    await translate.use('fr').toPromise();

    fixture = TestBed.createComponent(ConfirmDialogComponent);
    fixture.detectChanges();
  });

  it('renders translated default title and action labels', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Confirmer');
    expect(text).toContain('Annuler');
    expect(text).toContain('Supprimer');
  });
});

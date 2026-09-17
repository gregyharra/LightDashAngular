import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateService } from '@ngx-translate/core';
import { ApiErrorService } from './api-error.service';

describe('ApiErrorService', () => {
  it('uses the translated query fallback for query warnings', () => {
    const translate = {
      instant: jasmine
        .createSpy('instant')
        .and.returnValue('Impossible d’exécuter la requête.'),
    };

    TestBed.configureTestingModule({
      providers: [
        ApiErrorService,
        { provide: MatSnackBar, useValue: { open: jasmine.createSpy('open') } },
        { provide: TranslateService, useValue: translate },
      ],
    });

    const warning = TestBed.inject(ApiErrorService).queryErrorWarning(null);

    expect(translate.instant).toHaveBeenCalledWith('common.queryFailed');
    expect(warning.code).toBe('QUERY_FAILED');
    expect(warning.message).toContain('Impossible d’exécuter la requête.');
    expect(warning.severity).toBe('error');
  });
});

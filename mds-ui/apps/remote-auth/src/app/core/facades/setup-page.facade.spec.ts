import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideStore } from '@ngrx/store';
import { AuthService, SetupPayload } from '@mds-ui/core';
import { throwError } from 'rxjs';
import { SetupPageFacade } from './setup-page.facade';
import { authUiFeature } from '../store/auth-ui.reducer';

describe('SetupPageFacade', () => {
  it('sets error when setup fails', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideStore({ [authUiFeature.name]: authUiFeature.reducer }),
        SetupPageFacade,
        {
          provide: AuthService,
          useValue: {
            setup: () =>
              throwError(() => ({ error: { message: 'Setup failed' } })),
          },
        },
      ],
    });
    const facade = TestBed.inject(SetupPageFacade);

    facade.setup({
      email: 'a@b.c',
      firstName: 'A',
      lastName: 'B',
      password: 'password',
    } satisfies SetupPayload);

    expect(facade.error()).toBe('Setup failed');
    expect(facade.submitting()).toBe(false);
  });
});

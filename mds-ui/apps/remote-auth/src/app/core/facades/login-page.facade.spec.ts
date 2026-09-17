import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideStore } from '@ngrx/store';
import { AuthService, LoginPayload } from '@mds-ui/core';
import { of, throwError } from 'rxjs';
import { LoginPageFacade } from './login-page.facade';
import { authUiFeature } from '../store/auth-ui.reducer';

describe('LoginPageFacade', () => {
  function configure(auth: Pick<AuthService, 'login'>): LoginPageFacade {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideStore({ [authUiFeature.name]: authUiFeature.reducer }),
        LoginPageFacade,
        { provide: AuthService, useValue: auth },
      ],
    });

    return TestBed.inject(LoginPageFacade);
  }

  it('sets error when login fails', () => {
    const facade = configure({
      login: () => throwError(() => ({ error: { message: 'Nope' } })),
    } as Pick<AuthService, 'login'>);

    facade.login({ email: 'a@b.c', password: 'x' } satisfies LoginPayload);

    expect(facade.error()).toBe('Nope');
    expect(facade.submitting()).toBe(false);
  });

  it('clears error after login succeeds', () => {
    const facade = configure({
      login: () => of({ mustChangePassword: false }),
    } as Pick<AuthService, 'login'>);

    facade.login({ email: 'a@b.c', password: 'x' });

    expect(facade.error()).toBeNull();
    expect(facade.submitting()).toBe(false);
  });
});

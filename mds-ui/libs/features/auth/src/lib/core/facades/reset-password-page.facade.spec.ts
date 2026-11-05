import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideStore } from '@ngrx/store';
import { signal } from '@angular/core';
import { AppStateService, AuthService } from '@mds-ui/core';
import { of } from 'rxjs';
import { ResetPasswordPageFacade } from './reset-password-page.facade';
import { authUiFeature } from '../store/auth-ui.reducer';

describe('ResetPasswordPageFacade', () => {
  it('submits a new password and marks completion', () => {
    const resetPassword = jest.fn(() => of({}));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideStore({ [authUiFeature.name]: authUiFeature.reducer }),
        ResetPasswordPageFacade,
        { provide: AuthService, useValue: { resetPassword } },
        { provide: AppStateService, useValue: { user: signal(null) } },
      ],
    });
    const facade = TestBed.inject(ResetPasswordPageFacade);

    facade.resetPassword({ newPassword: 'password', token: 'token' });

    expect(resetPassword).toHaveBeenCalledWith({
      newPassword: 'password',
      token: 'token',
    });
    expect(facade.completed()).toBe(true);
    expect(facade.submitting()).toBe(false);
  });
});

import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  provideRouter,
} from '@angular/router';
import { AppStateService } from '../services/app-state.service';
import { authGuard, guestGuard, resetPasswordGuard, setupGuard } from './auth.guard';

describe('authentication guards with SSO', () => {
  const appState = {
    isBootstrapped: jasmine.createSpy('isBootstrapped').and.returnValue(true),
    bootstrap: jasmine.createSpy('bootstrap').and.resolveTo(undefined),
    isSetupComplete: jasmine.createSpy('isSetupComplete').and.returnValue(false),
    ssoEnabled: jasmine.createSpy('ssoEnabled').and.returnValue(true),
    authMode: jasmine.createSpy('authMode').and.returnValue('sso'),
    isAuthenticated: jasmine.createSpy('isAuthenticated').and.returnValue(false),
    mustChangePassword: jasmine.createSpy('mustChangePassword').and.returnValue(false),
    isAdmin: jasmine.createSpy('isAdmin').and.returnValue(false),
  };

  const route = {
    queryParamMap: { get: () => null },
  } as unknown as ActivatedRouteSnapshot;
  const state = { url: '/projects' } as RouterStateSnapshot;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AppStateService, useValue: appState },
      ],
    });
    appState.isSetupComplete.and.returnValue(false);
    appState.ssoEnabled.and.returnValue(true);
    appState.authMode.and.returnValue('sso');
    appState.isAuthenticated.and.returnValue(false);
  });

  async function runGuard(
    guard: typeof authGuard,
  ): Promise<ReturnType<typeof Router.prototype.createUrlTree> | boolean> {
    return TestBed.runInInjectionContext(() => guard(route, state)) as Promise<
      ReturnType<typeof Router.prototype.createUrlTree> | boolean
    >;
  }

  it('authGuard sends an unauthenticated SSO user to login instead of setup', async () => {
    const result = await runGuard(authGuard);
    expect(TestBed.inject(Router).serializeUrl(result as never)).toBe(
      '/login?redirect=%2Fprojects',
    );
  });

  it('guestGuard allows the SSO login page when backend setup is incomplete', async () => {
    expect(await runGuard(guestGuard)).toBeTrue();
  });

  it('setupGuard redirects SSO users away from setup', async () => {
    const result = await runGuard(setupGuard);
    expect(TestBed.inject(Router).serializeUrl(result as never)).toBe('/login');
  });

  it('resetPasswordGuard does not redirect SSO users to setup', async () => {
    expect(await runGuard(resetPasswordGuard)).toBeTrue();
  });

  it('still sends local users with incomplete setup to setup', async () => {
    appState.ssoEnabled.and.returnValue(false);
    appState.authMode.and.returnValue('local');

    const result = await runGuard(authGuard);
    expect(TestBed.inject(Router).serializeUrl(result as never)).toBe('/setup');
  });
});

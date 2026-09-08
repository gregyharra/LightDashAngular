import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, provideRouter } from '@angular/router';
import {
  provideTranslateService,
  TranslateService,
} from '@ngx-translate/core';
import { of } from 'rxjs';
import { AppStateService } from '../../../core/services/app-state.service';
import { AuthService } from '../../../core/services/auth.service';
import { LoginPageComponent } from './login-page.component';

describe('LoginPageComponent', () => {
  let fixture: ComponentFixture<LoginPageComponent>;
  let queryParams: Record<string, string>;
  const ssoEnabled = signal(false);
  const authMode = signal<'local' | 'sso'>('local');

  async function setup(params: Record<string, string> = {}): Promise<void> {
    queryParams = params;
    ssoEnabled.set(false);
    authMode.set('local');

    await TestBed.configureTestingModule({
      imports: [LoginPageComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'en', lang: 'en' }),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: (key: string) => queryParams[key] ?? null,
              },
            },
          },
        },
        {
          provide: AppStateService,
          useValue: {
            ssoEnabled: ssoEnabled.asReadonly(),
            authMode: authMode.asReadonly(),
          },
        },
        {
          provide: AuthService,
          useValue: { login: jasmine.createSpy('login').and.returnValue(of({})) },
        },
      ],
    }).compileComponents();

    TestBed.inject(TranslateService).setTranslation('en', {
      auth: {
        signInTitle: 'Sign in',
        signInSubtitle: 'Sign in to continue to your workspace.',
        signInWithSso: 'Sign in with SSO',
        email: 'Email',
        password: 'Password',
        signIn: 'Sign in',
        signingIn: 'Signing in…',
        forgotHint: 'Forgot your password?',
        errors: {
          invalidCredentials: 'Invalid email or password',
          ssoFailed: 'SSO sign-in failed. Please try again.',
          notProvisioned: 'Your account is not provisioned for this workspace.',
        },
      },
    });
  }

  function render(): void {
    fixture = TestBed.createComponent(LoginPageComponent);
    fixture.detectChanges();
  }

  it('renders the email and password form in local mode', async () => {
    await setup();
    render();

    expect(fixture.nativeElement.querySelector('input[type="email"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('input[type="password"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.auth-card__sso')).toBeNull();
  });

  it('renders only the SSO action in SSO mode and preserves redirect', async () => {
    await setup({ redirect: '/projects/project-1/explore?tab=metrics' });
    ssoEnabled.set(true);
    render();

    const action = fixture.nativeElement.querySelector(
      '.auth-card__sso',
    ) as HTMLAnchorElement;
    expect(action).toBeTruthy();
    expect(action.textContent?.trim()).toBe('Sign in with SSO');
    expect(action.getAttribute('color')).toBe('primary');
    expect(action.getAttribute('href')).toBe(
      '/api/auth/login?redirect=%2Fprojects%2Fproject-1%2Fexplore%3Ftab%3Dmetrics',
    );
    expect(fixture.nativeElement.querySelector('input')).toBeNull();
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  });

  it('treats the SSO auth mode as SSO even if the enabled flag is absent', async () => {
    await setup();
    authMode.set('sso');
    render();

    expect(fixture.nativeElement.querySelector('.auth-card__sso')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('input')).toBeNull();
  });

  [
    ['sso_failed', 'SSO sign-in failed. Please try again.'],
    ['not_provisioned', 'Your account is not provisioned for this workspace.'],
  ].forEach(([code, message]) => {
    it(`shows the translated ${code} error`, async () => {
      await setup({ error: code });
      ssoEnabled.set(true);
      render();

      expect(
        fixture.nativeElement.querySelector('.auth-card__error')?.textContent.trim(),
      ).toBe(message);
    });
  });
});

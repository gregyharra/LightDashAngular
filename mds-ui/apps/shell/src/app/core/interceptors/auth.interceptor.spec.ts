import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AppStateService } from '../services/app-state.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let router: Router;
  let clearUser: jasmine.Spy;

  beforeEach(() => {
    clearUser = jasmine.createSpy('clearUser');

    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'login', children: [] }]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        {
          provide: AppStateService,
          useValue: { clearUser },
        },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    spyOnProperty(router, 'url', 'get').and.returnValue('/settings/users');
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('logs out on session Authentication required 401', async () => {
    const pending = firstValueFrom(http.get('/api/v1/projects')).catch((err) => err);

    const req = httpMock.expectOne('/api/v1/projects');
    req.flush(
      {
        status: 'error',
        error: { name: 'Unauthorized', statusCode: 401, message: 'Authentication required' },
      },
      { status: 401, statusText: 'Unauthorized' },
    );

    const err = await pending;
    expect(err).toBeInstanceOf(HttpErrorResponse);
    expect(clearUser).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { redirect: '/settings/users' },
    });
  });

  it('does not log out on wrong-password 401 from change-password', async () => {
    const pending = firstValueFrom(
      http.post('/api/v1/user/password', {
        currentPassword: 'wrong',
        newPassword: 'new-password',
      }),
    ).catch((err) => err);

    const req = httpMock.expectOne('/api/v1/user/password');
    req.flush(
      {
        status: 'error',
        error: {
          name: 'Unauthorized',
          statusCode: 401,
          message: 'Current password is incorrect',
        },
      },
      { status: 401, statusText: 'Unauthorized' },
    );

    const err = await pending;
    expect(err).toBeInstanceOf(HttpErrorResponse);
    expect(clearUser).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});

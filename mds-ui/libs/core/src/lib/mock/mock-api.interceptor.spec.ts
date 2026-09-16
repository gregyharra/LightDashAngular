import { HttpHandlerFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of } from 'rxjs';
import { MOCK_API_ENABLED, mockApiInterceptor } from './mock-api.interceptor';

describe('mockApiInterceptor', () => {
  const request = new HttpRequest('GET', '/health');
  const next: jasmine.Spy<HttpHandlerFn> = jasmine
    .createSpy()
    .and.returnValue(of(new HttpResponse({ status: 204 })));

  afterEach(() => next.calls.reset());

  it('passes API requests through when mock mode is disabled', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: MOCK_API_ENABLED, useValue: false }],
    });

    TestBed.runInInjectionContext(() =>
      mockApiInterceptor(request, next).subscribe(),
    );

    expect(next).toHaveBeenCalledOnceWith(request);
  });

  it('handles API requests when mock mode is enabled', fakeAsync(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: MOCK_API_ENABLED, useValue: true }],
    });
    let response: HttpResponse<unknown> | undefined;

    TestBed.runInInjectionContext(() =>
      mockApiInterceptor(request, next).subscribe((event) => {
        if (event instanceof HttpResponse) response = event;
      }),
    );
    tick(80);

    expect(next).not.toHaveBeenCalled();
    expect(response?.status).toBe(200);
  }));
});

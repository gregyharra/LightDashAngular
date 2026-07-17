import { HttpHeaders, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { delay, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../api/api.types';
import { parseMockPath, resolveMockResponse } from './mock-api.router';

const MOCK_LATENCY_MS = 80;
const RESULTS_STREAM_PATTERN = /^\/projects\/[^/]+\/query\/[^/]+\/results$/;

function isApiRequest(url: string): boolean {
  return url.startsWith('/api/') || url === '/health' || url.startsWith('/health?');
}

function toMockRequest(url: string, method: string, body: unknown) {
  const { path, query } = parseMockPath(url.startsWith('/health') ? '/health' + url.slice('/health'.length) : url);

  return {
    method: method.toUpperCase(),
    path,
    query,
    body,
  };
}

export const mockApiInterceptor: HttpInterceptorFn = (request, next) => {
  if (!environment.useMockApi || !isApiRequest(request.url)) {
    return next(request);
  }

  const mockRequest = toMockRequest(request.url, request.method, request.body);
  const results = resolveMockResponse(mockRequest);

  if (
    request.method.toUpperCase() === 'GET' &&
    RESULTS_STREAM_PATTERN.test(mockRequest.path)
  ) {
    const response = new HttpResponse({
      status: 200,
      body: typeof results === 'string' ? results : '',
      headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
    });

    return of(response).pipe(delay(MOCK_LATENCY_MS));
  }

  const response = new HttpResponse<ApiResponse<unknown>>({
    status: 200,
    body: {
      status: 'ok',
      results,
    },
  });

  return of(response).pipe(delay(MOCK_LATENCY_MS));
};

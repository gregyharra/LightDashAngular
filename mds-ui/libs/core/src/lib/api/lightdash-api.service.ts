import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject, isDevMode } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiError, ApiResponse } from './api.types';

type RequestOptions = {
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean | undefined>;
  apiVersion?: 'v1' | 'v2';
};

@Injectable({ providedIn: 'root' })
export class LightdashApiService {
  private readonly http = inject(HttpClient);

  get<T>(url: string, options: RequestOptions = {}): Observable<T> {
    return this.request<T>('GET', url, undefined, options);
  }

  post<T>(url: string, body: unknown, options: RequestOptions = {}): Observable<T> {
    return this.request<T>('POST', url, body, options);
  }

  patch<T>(url: string, body: unknown, options: RequestOptions = {}): Observable<T> {
    return this.request<T>('PATCH', url, body, options);
  }

  put<T>(url: string, body: unknown, options: RequestOptions = {}): Observable<T> {
    return this.request<T>('PUT', url, body, options);
  }

  delete<T>(url: string, options: RequestOptions = {}): Observable<T> {
    return this.request<T>('DELETE', url, undefined, options);
  }

  private request<T>(
    method: string,
    url: string,
    body: unknown,
    options: RequestOptions,
  ): Observable<T> {
    const apiVersion = options.apiVersion ?? 'v1';
    const path = url.startsWith('/') ? url : `/${url}`;

    return this.http
      .request<ApiResponse<T>>(method, `/api/${apiVersion}${path}`, {
        body,
        headers: this.buildHeaders(options.headers),
        params: this.buildParams(options.params),
        withCredentials: true,
      })
      .pipe(
        map((response) => {
          if (response.status === 'error') {
            throw response;
          }

          return response.results;
        }),
      );
  }

  private buildHeaders(extra?: Record<string, string>): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Lightdash-Request-Method': 'WEB_APP',
      ...extra,
    });
  }

  private buildParams(
    params?: Record<string, string | number | boolean | undefined>,
  ): HttpParams | undefined {
    if (!params) {
      return undefined;
    }

    let httpParams = new HttpParams();

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        httpParams = httpParams.set(key, String(value));
      }
    }

    return httpParams;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (error as ApiError).status === 'error'
  );
}

function readErrorMessage(value: unknown): string | null {
  if (isApiError(value)) {
    return value.error.message;
  }

  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const nested = record['error'];
  if (typeof nested === 'object' && nested !== null) {
    const message = (nested as Record<string, unknown>)['message'];
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  if (typeof record['detail'] === 'string' && record['detail'].trim()) {
    return record['detail'];
  }

  if (typeof record['message'] === 'string' && record['message'].trim()) {
    return record['message'];
  }

  return null;
}

export function toApiError(error: unknown): ApiError {
  if (isApiError(error)) {
    return error;
  }

  if (error instanceof HttpErrorResponse) {
    const message =
      readErrorMessage(error.error) ??
      (error.message ||
        (error.status ? `Request failed (${error.status})` : 'Request failed'));

    return {
      status: 'error',
      error: {
        name: 'HttpErrorResponse',
        statusCode: error.status ?? 500,
        message,
      },
    };
  }

  const message = readErrorMessage(error);
  if (message) {
    return {
      status: 'error',
      error: {
        name: 'UnknownError',
        statusCode: 500,
        message,
      },
    };
  }

  return {
    status: 'error',
    error: {
      name: 'UnknownError',
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Unknown error',
    },
  };
}

function isGenericHttpMessage(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  return (
    !normalized ||
    normalized === 'unknown error' ||
    normalized === 'http failure response' ||
    normalized.startsWith('http failure response for ')
  );
}

export function apiErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  const apiError = toApiError(error);
  const message = apiError.error.message.trim();

  if (message && !isGenericHttpMessage(message)) {
    return message;
  }

  const statusHint = isDevMode() && apiError.error.statusCode
    ? ` (HTTP ${apiError.error.statusCode})`
    : '';

  return `${fallback}${statusHint}`;
}

import { HttpErrorResponse } from '@angular/common/http';
import { apiErrorMessage, isApiError, toApiError } from './lightdash-api.service';

describe('lightdash-api error helpers', () => {
  it('recognizes Lightdash API error envelopes', () => {
    const error = {
      status: 'error' as const,
      error: {
        name: 'BadRequest',
        statusCode: 400,
        message: 'No git repository URL configured for this project',
      },
    };

    expect(isApiError(error)).toBe(true);
    expect(apiErrorMessage(error)).toBe('No git repository URL configured for this project');
  });

  it('unwraps Lightdash errors from HttpErrorResponse bodies', () => {
    const error = new HttpErrorResponse({
      status: 400,
      statusText: 'Bad Request',
      error: {
        status: 'error',
        error: {
          name: 'BadRequest',
          statusCode: 400,
          message: 'No git repository URL configured for this project',
        },
      },
    });

    expect(apiErrorMessage(error)).toBe('No git repository URL configured for this project');
    expect(toApiError(error).error.statusCode).toBe(400);
  });

  it('falls back to HTTP status details when no API message is available', () => {
    const error = new HttpErrorResponse({
      status: 502,
      statusText: 'Bad Gateway',
      error: 'Bad Gateway',
    });

    expect(apiErrorMessage(error)).toContain('502');
  });

  it('uses a caller fallback when the API message is unavailable', () => {
    const error = new HttpErrorResponse({
      status: 0,
      statusText: 'Unknown Error',
      error: null,
    });

    expect(apiErrorMessage(error, 'Failed to load projects.')).toBe('Failed to load projects.');
  });
});

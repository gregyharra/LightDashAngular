/** Mirrors the LightDash backend envelope until @lightdash/common is wired in. */
export type ApiSuccess<T> = {
  status: 'ok';
  results: T;
};

export type ApiError = {
  status: 'error';
  error: {
    name: string;
    statusCode: number;
    message: string;
    data?: unknown;
  };
};

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export type HealthResults = {
  version: string;
  isAuthenticated: boolean;
  healthy?: boolean;
  query?: {
    defaultLimit?: number;
    maxLimit?: number;
    maxPageSize?: number;
  };
};

export type UserProfile = {
  userUuid: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
};

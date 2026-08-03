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
  isSetupComplete?: boolean;
  healthy?: boolean;
  /** Product flag from the API; Ask AI is shown only when true. */
  askAiEnabled?: boolean;
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
  isActive?: boolean;
  mustChangePassword?: boolean;
  abilityRules?: Array<{ action: string; subject: string }>;
};

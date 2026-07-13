export interface Environment {
  production: boolean;
  apiOrigin: string;
  /** Serve all API responses from in-memory mocks (no backend required). */
  useMockApi: boolean;
}

export type MockRequest = {
  method: string;
  path: string;
  query: URLSearchParams;
  body: unknown;
};

export type MockHandler = (request: MockRequest) => unknown;

export type MockRoute = {
  method?: string;
  pattern: RegExp;
  handler: MockHandler;
};

import { InjectionToken } from '@angular/core';

export interface AppDataInvalidator {
  invalidateAll(): void;
}

export const APP_DATA_INVALIDATOR = new InjectionToken<AppDataInvalidator>(
  'APP_DATA_INVALIDATOR',
  {
    providedIn: 'root',
    factory: () => ({ invalidateAll: () => undefined }),
  },
);

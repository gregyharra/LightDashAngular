import { ApplicationConfig, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { MAT_DIALOG_DEFAULT_OPTIONS } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { mockApiInterceptor } from './core/mock/mock-api.interceptor';
import { AppStateService } from './core/services/app-state.service';
import { provideAppStore } from './core/store';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    ...provideAppStore(),
    provideRouter(routes),
    provideAnimationsAsync(),
    {
      provide: MAT_DIALOG_DEFAULT_OPTIONS,
      useValue: {
        enterAnimationDuration: '0ms',
        exitAnimationDuration: '0ms',
        autoFocus: 'first-tabbable',
      },
    },
    provideHttpClient(withFetch(), withInterceptors([mockApiInterceptor, authInterceptor])),
    provideAppInitializer(() => inject(AppStateService).bootstrap()),
  ],
};

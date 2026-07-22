import { ApplicationConfig, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { MAT_DIALOG_DEFAULT_OPTIONS } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { mockApiInterceptor } from './core/mock/mock-api.interceptor';
import { AppStateService } from './core/services/app-state.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
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
    provideHttpClient(withFetch(), withInterceptors([mockApiInterceptor])),
    provideAppInitializer(() => inject(AppStateService).bootstrap()),
  ],
};

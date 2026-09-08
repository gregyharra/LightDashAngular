import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { LightdashApiService } from '../api/lightdash-api.service';
import { AppStateService } from './app-state.service';

describe('AppStateService', () => {
  it('treats a health response without legacy auth details as password auth enabled', async () => {
    const api = {
      get: jasmine.createSpy('get').and.callFake((path: string) =>
        of(
          path === '/health'
            ? {
                version: '0.1.0',
                isAuthenticated: false,
                isSetupComplete: true,
                authMode: 'local',
                ssoEnabled: false,
              }
            : {},
        ),
      ),
    };

    await TestBed.configureTestingModule({
      providers: [
        AppStateService,
        { provide: LightdashApiService, useValue: api },
      ],
    }).compileComponents();

    const service = TestBed.inject(AppStateService);
    await service.refresh();

    expect(service.passwordAuthDisabled()).toBeFalse();
  });
});

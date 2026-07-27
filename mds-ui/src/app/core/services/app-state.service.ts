import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { HealthResults, UserProfile } from '../api/api.types';
import { LightdashApiService } from '../api/lightdash-api.service';

function isUserProfile(value: unknown): value is UserProfile {
  return (
    !!value &&
    typeof value === 'object' &&
    'userUuid' in value &&
    typeof (value as UserProfile).userUuid === 'string' &&
    !!(value as UserProfile).userUuid
  );
}

@Injectable({ providedIn: 'root' })
export class AppStateService {
  private readonly api = inject(LightdashApiService);

  private readonly healthSignal = signal<HealthResults | null>(null);
  private readonly userSignal = signal<UserProfile | null>(null);
  private readonly bootstrappedSignal = signal(false);

  readonly health = this.healthSignal.asReadonly();
  readonly user = this.userSignal.asReadonly();
  readonly isBootstrapped = this.bootstrappedSignal.asReadonly();

  readonly isAuthenticated = computed(() => !!this.healthSignal()?.isAuthenticated);
  readonly isSetupComplete = computed(() => !!this.healthSignal()?.isSetupComplete);
  readonly isAdmin = computed(() => this.userSignal()?.role === 'admin');

  async bootstrap(): Promise<void> {
    if (this.bootstrappedSignal()) {
      return;
    }
    await this.refresh();
    this.bootstrappedSignal.set(true);
  }

  async refresh(): Promise<void> {
    const [health, user] = await Promise.all([
      firstValueFrom(
        this.api.get<HealthResults>('/health', {
          apiVersion: 'v1',
          params: { skipMigrationCheck: true },
        }),
      ),
      firstValueFrom(this.api.get<UserProfile | Record<string, never>>('/user')),
    ]);

    this.healthSignal.set(health);
    this.userSignal.set(isUserProfile(user) ? user : null);
  }

  clearUser(): void {
    this.userSignal.set(null);
    const health = this.healthSignal();
    if (health) {
      this.healthSignal.set({ ...health, isAuthenticated: false });
    }
  }
}

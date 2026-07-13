import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { HealthResults, UserProfile } from '../api/api.types';
import { LightdashApiService } from '../api/lightdash-api.service';

@Injectable({ providedIn: 'root' })
export class AppStateService {
  private readonly api = inject(LightdashApiService);

  private readonly healthSignal = signal<HealthResults | null>(null);
  private readonly userSignal = signal<UserProfile | null>(null);
  private readonly bootstrappedSignal = signal(false);

  readonly health = this.healthSignal.asReadonly();
  readonly user = this.userSignal.asReadonly();
  readonly isBootstrapped = this.bootstrappedSignal.asReadonly();

  async bootstrap(): Promise<void> {
    if (this.bootstrappedSignal()) {
      return;
    }

    const [health, user] = await Promise.all([
      firstValueFrom(
        this.api.get<HealthResults>('/health', {
          apiVersion: 'v1',
          params: { skipMigrationCheck: true },
        }),
      ),
      firstValueFrom(this.api.get<UserProfile>('/user')),
    ]);

    this.healthSignal.set(health);
    this.userSignal.set(user);
    this.bootstrappedSignal.set(true);
  }
}

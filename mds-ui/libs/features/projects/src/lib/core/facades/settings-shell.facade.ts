import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@mds-ui/core';

@Injectable({ providedIn: 'root' })
export class SettingsShellFacade {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  logout(): void {
    this.auth.logout().subscribe({
      next: () => void this.router.navigate(['/login']),
      error: () => void this.router.navigate(['/login']),
    });
  }
}

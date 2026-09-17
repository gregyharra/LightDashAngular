import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { TranslatePipe } from '@ngx-translate/core';
import {
  AppLanguage,
  LanguageService,
} from '@mds-ui/core';
import { AppStateService } from '@mds-ui/core';
import { AuthService } from '@mds-ui/core';

@Component({
  selector: 'app-navbar-user-menu',
  imports: [
    RouterLink,
    MatIconModule,
    MatMenuModule,
    TranslatePipe,
  ],
  templateUrl: './navbar-user-menu.component.html',
  styleUrl: './navbar-user-menu.component.scss',
})
export class NavbarUserMenuComponent {
  private readonly appState = inject(AppStateService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly languageService = inject(LanguageService);

  protected readonly user = this.appState.user;
  protected readonly isAdmin = this.appState.isAdmin;

  protected logout(): void {
    this.auth.logout().subscribe({
      next: () => void this.router.navigate(['/login']),
      error: () => void this.router.navigate(['/login']),
    });
  }

  protected setLanguage(lang: AppLanguage): void {
    void this.languageService.setLanguage(lang);
  }
}

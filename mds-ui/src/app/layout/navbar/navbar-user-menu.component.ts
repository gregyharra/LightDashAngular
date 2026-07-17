import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { AppStateService } from '../../core/services/app-state.service';

@Component({
  selector: 'app-navbar-user-menu',
  imports: [MatButtonModule, MatIconModule, MatMenuModule],
  templateUrl: './navbar-user-menu.component.html',
  styleUrl: './navbar-user-menu.component.scss',
})
export class NavbarUserMenuComponent {
  private readonly appState = inject(AppStateService);

  protected readonly user = this.appState.user;

  protected initials(): string {
    const u = this.user();
    if (!u) {
      return '?';
    }
    return `${u.firstName[0] ?? ''}${u.lastName[0] ?? ''}`.trim() || '?';
  }
}

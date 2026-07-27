import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { AppStateService } from '../../core/services/app-state.service';
import { AuthService } from '../../core/services/auth.service';
import { ChangePasswordDialogComponent } from '../navbar/navbar-user-menu.component';

@Component({
  selector: 'app-settings-sidebar-nav',
  imports: [RouterLink, RouterLinkActive, MatIconModule],
  template: `
    <header class="settings-nav__header">
      <p class="settings-nav__email">{{ appState.user()?.email }}</p>
      <p class="settings-nav__label">Settings</p>
    </header>

    <nav class="page-sidebar__nav settings-nav" aria-label="Settings navigation">
      <a
        class="page-sidebar__link page-sidebar__link--clickable"
        routerLink="/settings/projects"
        routerLinkActive="page-sidebar__link--active"
        [routerLinkActiveOptions]="{ exact: false }"
      >
        <mat-icon>folder</mat-icon>
        Projects
      </a>
      @if (appState.isAdmin()) {
        <a
          class="page-sidebar__link page-sidebar__link--clickable"
          routerLink="/settings/warehouses"
          routerLinkActive="page-sidebar__link--active"
          [routerLinkActiveOptions]="{ exact: false }"
        >
          <mat-icon>storage</mat-icon>
          Warehouses
        </a>
        <a
          class="page-sidebar__link page-sidebar__link--clickable"
          routerLink="/settings/users"
          routerLinkActive="page-sidebar__link--active"
          [routerLinkActiveOptions]="{ exact: false }"
        >
          <mat-icon>group</mat-icon>
          Users
        </a>
      }
      <button
        type="button"
        class="page-sidebar__link page-sidebar__link--clickable"
        (click)="changePassword()"
      >
        <mat-icon>lock</mat-icon>
        Change password
      </button>
      <button
        type="button"
        class="page-sidebar__link page-sidebar__link--clickable"
        (click)="logout()"
      >
        <mat-icon>logout</mat-icon>
        Logout
      </button>
    </nav>
  `,
  styles: `
    .settings-nav__header {
      flex-shrink: 0;
      margin-bottom: var(--ld-spacing-md);
      padding-right: 36px;
    }

    .settings-nav__email {
      margin: 0 0 var(--ld-spacing-xxs);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: var(--ld-font-size-xs);
      color: var(--ld-gray-6);
    }

    .settings-nav__label {
      margin: 0;
      font-size: var(--ld-font-size-xs);
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--ld-gray-9);
    }

    .settings-nav {
      gap: 4px;
    }

    .page-sidebar__link--clickable {
      cursor: pointer;
      text-decoration: none;
      color: inherit;
      white-space: nowrap;
    }

    button.page-sidebar__link--clickable {
      width: 100%;
      font: inherit;
    }

    .page-sidebar--collapsed .settings-nav__header {
      height: 0;
      margin: 0;
      overflow: hidden;
      opacity: 0;
      pointer-events: none;
    }
  `,
})
export class SettingsSidebarNavComponent {
  protected readonly appState = inject(AppStateService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);

  protected changePassword(): void {
    this.dialog.open(ChangePasswordDialogComponent, { width: '24rem' });
  }

  protected logout(): void {
    this.auth.logout().subscribe({
      next: () => void this.router.navigate(['/login']),
      error: () => void this.router.navigate(['/login']),
    });
  }
}

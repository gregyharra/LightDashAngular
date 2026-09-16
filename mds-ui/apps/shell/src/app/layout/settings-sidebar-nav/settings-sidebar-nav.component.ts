import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { AppStateService } from '../../core/services/app-state.service';
import { AuthService } from '../../core/services/auth.service';
import { ChangePasswordDialogComponent } from '../navbar/navbar-user-menu.component';

@Component({
  selector: 'app-settings-sidebar-nav',
  imports: [
    RouterLink,
    RouterLinkActive,
    MatIconModule,
    TranslatePipe,
  ],
  template: `
    <header class="settings-nav__header">
      <p class="settings-nav__email">{{ appState.user()?.email }}</p>
      <p class="settings-nav__label">{{ 'settings.title' | translate }}</p>
    </header>

    <nav
      class="page-sidebar__nav settings-nav"
      [attr.aria-label]="'settings.navigation' | translate"
    >
      <a
        class="page-sidebar__link page-sidebar__link--clickable"
        routerLink="/settings/projects"
        routerLinkActive="page-sidebar__link--active"
        [routerLinkActiveOptions]="{ exact: false }"
      >
        <mat-icon fontIcon="folder" aria-hidden="true"></mat-icon>
        <span class="settings-nav__item-label">{{ 'settings.projects' | translate }}</span>
      </a>
      @if (appState.isAdmin()) {
        <a
          class="page-sidebar__link page-sidebar__link--clickable"
          routerLink="/settings/warehouses"
          routerLinkActive="page-sidebar__link--active"
          [routerLinkActiveOptions]="{ exact: false }"
        >
          <mat-icon fontIcon="storage" aria-hidden="true"></mat-icon>
          <span class="settings-nav__item-label">{{ 'settings.warehouses' | translate }}</span>
        </a>
        <a
          class="page-sidebar__link page-sidebar__link--clickable"
          routerLink="/settings/users"
          routerLinkActive="page-sidebar__link--active"
          [routerLinkActiveOptions]="{ exact: false }"
        >
          <mat-icon fontIcon="group" aria-hidden="true"></mat-icon>
          <span class="settings-nav__item-label">{{ 'settings.users' | translate }}</span>
        </a>
      }
      <button
        type="button"
        class="page-sidebar__link page-sidebar__link--clickable"
        (click)="changePassword()"
      >
        <mat-icon fontIcon="lock" aria-hidden="true"></mat-icon>
        <span class="settings-nav__item-label">{{ 'settings.changePassword' | translate }}</span>
      </button>
      <button
        type="button"
        class="page-sidebar__link page-sidebar__link--clickable"
        (click)="logout()"
      >
        <mat-icon fontIcon="logout" aria-hidden="true"></mat-icon>
        <span class="settings-nav__item-label">{{ 'settings.logout' | translate }}</span>
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
      min-width: 0;
    }

    .page-sidebar__link--clickable {
      box-sizing: border-box;
      cursor: pointer;
      text-decoration: none;
      color: inherit;
      white-space: nowrap;
      min-width: 0;
    }

    button.page-sidebar__link--clickable {
      display: flex;
      align-items: center;
      gap: var(--ld-spacing-xs);
      width: 100%;
      margin: 0;
      appearance: none;
      -webkit-appearance: none;
      font-family: inherit;
      font-size: inherit;
      font-weight: inherit;
      line-height: inherit;
      letter-spacing: inherit;
    }

    .page-sidebar__link--clickable mat-icon {
      flex-shrink: 0;
      width: 16px;
      height: 16px;
      font-size: 16px;
      line-height: 16px;
      color: var(--ld-gray-6);
    }

    .page-sidebar__link--clickable.page-sidebar__link--active mat-icon {
      color: var(--ld-gray-9);
    }

    .settings-nav__item-label {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    :host-context(.page-sidebar--collapsed) .settings-nav__header {
      height: 0;
      margin: 0;
      padding: 0;
      overflow: hidden;
      opacity: 0;
      pointer-events: none;
    }

    :host-context(.page-sidebar--collapsed) .settings-nav__item-label {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
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

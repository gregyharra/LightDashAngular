import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AppStateService } from '../../core/services/app-state.service';

export type SettingsNavItem = 'projects' | 'warehouses' | 'users';

@Component({
  selector: 'app-settings-sidebar-nav',
  imports: [RouterLink, MatIconModule],
  template: `
    <nav class="page-sidebar__nav" aria-label="Workspace navigation">
      <p class="page-sidebar__section-label">Your workspace</p>
      <a
        class="page-sidebar__link page-sidebar__link--clickable"
        routerLink="/projects"
        [class.page-sidebar__link--active]="active() === 'projects'"
      >
        <mat-icon>folder</mat-icon>
        Projects
      </a>
      @if (appState.isAdmin()) {
        <a
          class="page-sidebar__link page-sidebar__link--clickable"
          routerLink="/warehouses"
          [class.page-sidebar__link--active]="active() === 'warehouses'"
        >
          <mat-icon>storage</mat-icon>
          Warehouses
        </a>
        <a
          class="page-sidebar__link page-sidebar__link--clickable"
          routerLink="/users"
          [class.page-sidebar__link--active]="active() === 'users'"
        >
          <mat-icon>group</mat-icon>
          Users
        </a>
      }
    </nav>
  `,
  styles: `
    .page-sidebar__link--clickable {
      cursor: pointer;
      text-decoration: none;
      color: inherit;
    }
  `,
})
export class SettingsSidebarNavComponent {
  readonly active = input.required<SettingsNavItem>();
  protected readonly appState = inject(AppStateService);
}

import { Component, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

export type SettingsNavItem = 'projects' | 'warehouses';

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
      <a
        class="page-sidebar__link page-sidebar__link--clickable"
        routerLink="/warehouses"
        [class.page-sidebar__link--active]="active() === 'warehouses'"
      >
        <mat-icon>storage</mat-icon>
        Warehouses
      </a>
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
}

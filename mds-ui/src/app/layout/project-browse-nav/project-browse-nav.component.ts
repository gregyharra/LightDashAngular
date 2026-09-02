import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';

export type ProjectBrowseNavActive =
  | 'explore'
  | 'dashboards'
  | 'charts'
  | 'tables'
  | 'lineage';

interface BrowseNavItem {
  id: ProjectBrowseNavActive;
  path: string;
  icon: string;
  labelKey: string;
}

@Component({
  selector: 'app-project-browse-nav',
  imports: [RouterLink, MatIconModule, TranslatePipe],
  template: `
    <a
      class="project-browse-nav__home"
      routerLink="/projects"
      [attr.title]="'nav.home' | translate"
      [attr.aria-label]="'nav.home' | translate"
      data-testid="project-browse-nav-home"
    >
      <mat-icon fontIcon="home" aria-hidden="true"></mat-icon>
    </a>

    <nav
      class="page-sidebar__nav project-browse-nav"
      [attr.aria-label]="'nav.browseNavigation' | translate"
      data-testid="project-browse-nav"
    >
      @for (item of items; track item.id) {
        <a
          class="page-sidebar__link page-sidebar__link--clickable"
          [class.page-sidebar__link--active]="active() === item.id"
          [attr.data-nav]="item.id"
          [routerLink]="['/projects', projectUuid(), item.path]"
        >
          <mat-icon [fontIcon]="item.icon" aria-hidden="true"></mat-icon>
          <span class="project-browse-nav__label">{{ item.labelKey | translate }}</span>
        </a>
      }
    </nav>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }

    .project-browse-nav__home {
      box-sizing: border-box;
      display: grid;
      place-items: center;
      width: 36px;
      height: 36px;
      margin-bottom: 8px;
      border-radius: 8px;
      color: #e5e7eb;
      text-decoration: none;
      transition: background-color 150ms ease;

      mat-icon {
        width: 18px;
        height: 18px;
        font-size: 18px;
        line-height: 18px;
      }

      &:hover {
        background: var(--ld-sidebar-dark-hover);
      }
    }

    .project-browse-nav {
      gap: 4px;
      min-width: 0;
    }

    .page-sidebar__link--clickable {
      box-sizing: border-box;
      height: 40px;
      padding: 0 10px;
      border-radius: 8px;
      color: #cfd3dc;
      font-size: 0.9rem;
      font-weight: 500;
      text-decoration: none;
      cursor: pointer;
      white-space: nowrap;
      min-width: 0;

      mat-icon {
        flex-shrink: 0;
        width: 16px;
        height: 16px;
        font-size: 16px;
        line-height: 16px;
        color: inherit;
        opacity: 0.85;
      }

      &:hover {
        background: var(--ld-sidebar-dark-hover);
        color: #fff;
      }

      &.page-sidebar__link--active {
        background: var(--ld-sidebar-dark-active);
        color: #fff;
        font-weight: 600;

        mat-icon {
          opacity: 1;
          color: #fff;
        }
      }
    }

    .project-browse-nav__label {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    :host-context(.page-sidebar--collapsed) .project-browse-nav__home {
      display: none;
    }

    :host-context(.page-sidebar--collapsed) .project-browse-nav__label {
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
export class ProjectBrowseNavComponent {
  readonly projectUuid = input.required<string>();
  readonly active = input.required<ProjectBrowseNavActive>();

  protected readonly items: readonly BrowseNavItem[] = [
    {
      id: 'explore',
      path: 'explore',
      icon: 'search',
      labelKey: 'explorer.title',
    },
    {
      id: 'dashboards',
      path: 'dashboards',
      icon: 'dashboard',
      labelKey: 'nav.dashboard',
    },
    {
      id: 'charts',
      path: 'charts',
      icon: 'bar_chart',
      labelKey: 'nav.graph',
    },
    {
      id: 'tables',
      path: 'tables',
      icon: 'table_chart',
      labelKey: 'tables.title',
    },
    {
      id: 'lineage',
      path: 'lineage',
      icon: 'account_tree',
      labelKey: 'lineage.title',
    },
  ];
}

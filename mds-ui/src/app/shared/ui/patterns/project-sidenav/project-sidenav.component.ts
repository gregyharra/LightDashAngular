import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

export interface DpfProjectSidenavItem {
  readonly id: string;
  readonly path: string;
  readonly icon: string;
  readonly label: string;
}

@Component({
  selector: 'dpf-project-sidenav',
  imports: [RouterLink, MatIconModule],
  template: `
    <a
      class="dpf-project-sidenav__home"
      routerLink="/projects"
      [attr.title]="homeLabel()"
      [attr.aria-label]="homeLabel()"
      data-testid="project-browse-nav-home"
    >
      <mat-icon fontIcon="home" aria-hidden="true"></mat-icon>
    </a>

    <nav
      class="page-sidebar__nav dpf-project-sidenav"
      [attr.aria-label]="navigationLabel()"
      data-testid="project-browse-nav"
    >
      @for (item of items(); track item.id) {
        <a
          class="page-sidebar__link page-sidebar__link--clickable"
          [class.page-sidebar__link--active]="active() === item.id"
          [attr.data-nav]="item.id"
          [routerLink]="['/projects', projectUuid(), item.path]"
        >
          <mat-icon [fontIcon]="item.icon" aria-hidden="true"></mat-icon>
          <span class="dpf-project-sidenav__label">{{ item.label }}</span>
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

    .dpf-project-sidenav__home {
      box-sizing: border-box;
      display: grid;
      place-items: center;
      width: 36px;
      height: 36px;
      margin-bottom: 8px;
      border-radius: 8px;
      color: var(--ld-color-on-sidebar);
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

    .dpf-project-sidenav {
      gap: 4px;
      min-width: 0;
    }

    .page-sidebar__link--clickable {
      box-sizing: border-box;
      height: 40px;
      min-width: 0;
      padding: 0 10px;
      border-radius: 8px;
      color: var(--ld-color-on-sidebar-muted);
      font-size: 0.9rem;
      font-weight: 500;
      text-decoration: none;
      cursor: pointer;
      white-space: nowrap;

      mat-icon {
        flex-shrink: 0;
        width: 16px;
        height: 16px;
        color: inherit;
        font-size: 16px;
        line-height: 16px;
        opacity: 0.85;
      }

      &:hover {
        background: var(--ld-sidebar-dark-hover);
        color: var(--ld-color-on-sidebar);
      }

      &.page-sidebar__link--active {
        background: var(--ld-sidebar-dark-active);
        color: var(--ld-color-on-sidebar);
        font-weight: 600;

        mat-icon {
          color: inherit;
          opacity: 1;
        }
      }
    }

    .dpf-project-sidenav__label {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    :host-context(.page-sidebar--collapsed) .dpf-project-sidenav__home {
      display: none;
    }

    :host-context(.page-sidebar--collapsed) .dpf-project-sidenav__label {
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
export class DpfProjectSidenavComponent {
  readonly projectUuid = input.required<string>();
  readonly active = input.required<string>();
  readonly items = input.required<readonly DpfProjectSidenavItem[]>();
  readonly homeLabel = input.required<string>();
  readonly navigationLabel = input.required<string>();
}

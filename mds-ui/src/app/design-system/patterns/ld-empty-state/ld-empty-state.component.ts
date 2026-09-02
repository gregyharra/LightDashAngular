import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'ld-empty-state',
  imports: [MatIconModule],
  host: {
    class: 'ld-empty-state',
  },
  template: `
    @if (icon(); as iconName) {
      <mat-icon class="ld-empty-state__icon" aria-hidden="true">{{ iconName }}</mat-icon>
    }
    <h2 class="ld-empty-state__title">{{ title() }}</h2>
    @if (body(); as bodyText) {
      <p class="ld-empty-state__body">{{ bodyText }}</p>
    }
    <ng-content select="[ldCta]" />
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--ld-space-sm);
      min-width: 0;
      padding: var(--ld-space-xl);
      text-align: center;
    }

    .ld-empty-state__icon {
      color: var(--ld-color-muted);
    }

    .ld-empty-state__title,
    .ld-empty-state__body {
      margin: 0;
    }

    .ld-empty-state__title {
      color: var(--ld-color-fg);
    }

    .ld-empty-state__body {
      max-width: 36rem;
      color: var(--ld-color-muted);
      font-size: var(--ld-font-size-sm);
    }

    :host ::ng-deep > [ldCta] {
      flex-shrink: 0;
      margin-top: var(--ld-space-xs);
    }
  `,
})
export class LdEmptyStateComponent {
  readonly title = input.required<string>();
  readonly body = input<string | null>(null);
  readonly icon = input<string | null>(null);
}

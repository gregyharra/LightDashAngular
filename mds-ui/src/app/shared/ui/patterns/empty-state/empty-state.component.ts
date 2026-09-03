import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'dpf-empty-state',
  imports: [MatIconModule],
  host: {
    class: 'dpf-empty-state',
  },
  template: `
    @if (icon(); as iconName) {
      <mat-icon class="dpf-empty-state__icon" aria-hidden="true">{{ iconName }}</mat-icon>
    }
    <h2 class="dpf-empty-state__title">{{ title() }}</h2>
    @if (body(); as bodyText) {
      <p class="dpf-empty-state__body">{{ bodyText }}</p>
    }
    <ng-content select="[dpfCta]" />
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

    .dpf-empty-state__icon {
      color: var(--ld-color-muted);
    }

    .dpf-empty-state__title,
    .dpf-empty-state__body {
      margin: 0;
    }

    .dpf-empty-state__title {
      color: var(--ld-color-fg);
    }

    .dpf-empty-state__body {
      max-width: 36rem;
      color: var(--ld-color-muted);
      font-size: var(--ld-font-size-sm);
    }

    :host ::ng-deep > [dpfCta] {
      flex-shrink: 0;
      margin-top: var(--ld-space-xs);
    }
  `,
})
export class DpfEmptyStateComponent {
  readonly title = input.required<string>();
  readonly body = input<string | null>(null);
  readonly icon = input<string | null>(null);
}

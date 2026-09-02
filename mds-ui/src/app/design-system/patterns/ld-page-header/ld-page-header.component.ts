import { Component, input } from '@angular/core';
import { LdActionClusterComponent } from '../ld-action-cluster/ld-action-cluster.component';

@Component({
  selector: 'ld-page-header',
  imports: [LdActionClusterComponent],
  host: {
    class: 'ld-page-header page-header',
  },
  template: `
    <div class="ld-page-header__title-row page-header__title-row">
      <div class="ld-page-header__title-block page-header__title-block">
        <h1>{{ title() }}</h1>
        @if (subtitle(); as subtitleText) {
          <p class="ld-page-header__subtitle">{{ subtitleText }}</p>
        }
      </div>
      <ld-action-cluster class="ld-page-header__actions page-header__actions">
        <ng-content select="[ldActions]" />
      </ld-action-cluster>
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
      width: 100%;
    }

    h1,
    p {
      margin: 0;
    }

    h1 {
      color: var(--ld-color-fg);
    }

    .ld-page-header__subtitle {
      margin-top: var(--ld-space-xs);
      color: var(--ld-color-muted);
      font-size: var(--ld-font-size-sm);
    }
  `,
})
export class LdPageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
}

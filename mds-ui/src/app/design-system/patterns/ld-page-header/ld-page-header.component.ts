import { Component, input } from '@angular/core';
import { LdActionClusterComponent } from '../ld-action-cluster/ld-action-cluster.component';

@Component({
  selector: 'ld-page-header',
  imports: [LdActionClusterComponent],
  host: {
    class: 'ld-page-header page-header',
    '[class.ld-page-header--brand]': "titleTone() === 'brand'",
  },
  template: `
    <div class="ld-page-header__title-row page-header__title-row">
      <div class="ld-page-header__title-block page-header__title-block">
        <h1 class="ld-page-header__title">{{ title() }}</h1>
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

    .ld-page-header__title {
      margin: 0 0 var(--ld-space-xxs);
      font-size: 18px;
      font-weight: 600;
      line-height: 1.3;
      color: var(--ld-color-fg);
    }

    :host(.ld-page-header--brand) .ld-page-header__title {
      color: var(--ld-color-brand);
    }

    .ld-page-header__subtitle {
      margin: 0;
      font-size: var(--ld-font-size-sm);
      color: var(--ld-color-muted);
    }
  `,
})
export class LdPageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
  readonly titleTone = input<'default' | 'brand'>('default');
}

import { Component, input } from '@angular/core';
import { DpfActionClusterComponent } from '../action-cluster/action-cluster.component';

@Component({
  selector: 'dpf-page-header',
  imports: [DpfActionClusterComponent],
  host: {
    class: 'dpf-page-header page-header',
    '[class.dpf-page-header--brand]': "titleTone() === 'brand'",
  },
  template: `
    <div class="dpf-page-header__title-row page-header__title-row">
      <div class="dpf-page-header__title-block page-header__title-block">
        <h1 class="dpf-page-header__title">{{ title() }}</h1>
        @if (subtitle(); as subtitleText) {
          <p class="dpf-page-header__subtitle">{{ subtitleText }}</p>
        }
      </div>
      <dpf-action-cluster class="dpf-page-header__actions page-header__actions">
        <ng-content select="[dpfActions]" />
      </dpf-action-cluster>
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
      width: 100%;
    }

    .dpf-page-header__title {
      margin: 0 0 var(--ld-space-xxs);
      font-size: 18px;
      font-weight: 600;
      line-height: 1.3;
      color: var(--ld-color-fg);
    }

    :host(.dpf-page-header--brand) .dpf-page-header__title {
      color: var(--ld-color-brand);
    }

    .dpf-page-header__subtitle {
      margin: 0;
      font-size: var(--ld-font-size-sm);
      color: var(--ld-color-muted);
    }
  `,
})
export class DpfPageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
  readonly titleTone = input<'default' | 'brand'>('default');
}

import { Component, input } from '@angular/core';

@Component({
  selector: 'dpf-page-frame',
  host: {
    class: 'dpf-page-frame',
  },
  template: `
    <div
      class="dpf-page-frame__container page__container"
      [class.page__container--wide]="wide()"
    >
      <ng-content />
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
      width: 100%;
    }

    .dpf-page-frame__container {
      min-width: 0;
    }
  `,
})
export class DpfPageFrameComponent {
  readonly wide = input(false);
}

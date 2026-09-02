import { Component, input } from '@angular/core';

@Component({
  selector: 'ld-page-frame',
  host: {
    class: 'ld-page-frame',
  },
  template: `
    <div
      class="ld-page-frame__container page__container"
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

    .ld-page-frame__container {
      min-width: 0;
    }
  `,
})
export class LdPageFrameComponent {
  readonly wide = input(false);
}

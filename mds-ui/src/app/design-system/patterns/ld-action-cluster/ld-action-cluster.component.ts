import { Component } from '@angular/core';

@Component({
  selector: 'ld-action-cluster',
  host: {
    class: 'ld-action-cluster',
  },
  template: '<ng-content />',
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: flex-end;
      gap: var(--ld-space-sm);
      min-width: 0;
      max-width: 100%;
    }

    :host ::ng-deep > * {
      flex-shrink: 0;
    }
  `,
})
export class LdActionClusterComponent {}

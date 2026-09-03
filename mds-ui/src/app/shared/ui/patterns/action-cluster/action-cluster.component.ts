import { Component } from '@angular/core';

@Component({
  selector: 'dpf-action-cluster',
  host: {
    class: 'dpf-action-cluster',
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
      white-space: nowrap;
    }
  `,
})
export class DpfActionClusterComponent {}

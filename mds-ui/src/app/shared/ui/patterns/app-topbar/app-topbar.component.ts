import { Component } from '@angular/core';

@Component({
  selector: 'dpf-app-topbar',
  host: {
    class: 'dpf-app-topbar',
  },
  template: `
    <header class="dpf-app-topbar__layout">
      <div class="dpf-app-topbar__brand">
        <ng-content select="[ldBrand]" />
      </div>
      <div class="dpf-app-topbar__center">
        <ng-content select="[ldCenter]" />
      </div>
      <div class="dpf-app-topbar__actions">
        <ng-content select="[dpfActions]" />
      </div>
    </header>
  `,
  styles: `
    :host {
      position: relative;
      z-index: 200;
      display: block;
      flex: 0 0 var(--ld-navbar-height);
      height: var(--ld-navbar-height);
      min-height: var(--ld-navbar-height);
      max-height: var(--ld-navbar-height);
      min-width: 0;
      overflow-x: clip;
      overflow-y: hidden;
      background: var(--ld-color-bg);
      border-bottom: 1px solid var(--ld-color-border);
    }

    .dpf-app-topbar__layout {
      display: grid;
      grid-template-columns: 1fr minmax(220px, 420px) 1fr;
      align-items: center;
      gap: var(--ld-space-md);
      height: 100%;
      min-width: 0;
      padding: 0 var(--ld-space-lg);
    }

    .dpf-app-topbar__brand,
    .dpf-app-topbar__center,
    .dpf-app-topbar__actions {
      min-width: 0;
    }

    .dpf-app-topbar__brand,
    .dpf-app-topbar__actions {
      display: flex;
      align-items: center;
    }

    .dpf-app-topbar__actions {
      justify-content: flex-end;
      gap: var(--ld-space-sm);
    }

    @media (max-width: 860px) {
      .dpf-app-topbar__layout {
        grid-template-columns: auto minmax(140px, 1fr) auto;
        gap: var(--ld-space-sm);
        padding-inline: var(--ld-space-md);
      }
    }

    @media (max-width: 720px) {
      .dpf-app-topbar__layout {
        gap: var(--ld-space-xs);
        padding-inline: var(--ld-space-sm);
      }

      .dpf-app-topbar__actions {
        gap: var(--ld-space-xs);
      }
    }

    @media (max-width: 480px) {
      .dpf-app-topbar__brand,
      .dpf-app-topbar__actions {
        gap: var(--ld-space-xxs);
      }
    }
  `,
})
export class DpfAppTopbarComponent {}

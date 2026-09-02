import { Component, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'ld-icon-button',
  imports: [MatButtonModule, MatIconModule],
  host: {
    class: 'ld-icon-button',
    '[class.ld-icon-button--ai]': "tone() === 'ai'",
  },
  template: `
    <button
      mat-icon-button
      type="button"
      [disabled]="disabled()"
      [attr.aria-label]="ariaLabel()"
    >
      <mat-icon [fontIcon]="icon()" />
    </button>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex: 0 0 40px;
      width: 40px;
      height: 40px;
    }

    button {
      width: 40px;
      height: 40px;
      border-radius: var(--ld-radius-pill);
      color: var(--ld-color-fg);
    }

    :host(.ld-icon-button--ai) button {
      color: var(--ld-color-brand);
    }
  `,
})
export class LdIconButtonComponent {
  readonly icon = input.required<string>();
  readonly ariaLabel = input.required<string>();
  readonly disabled = input(false);
  readonly tone = input<'default' | 'ai'>('default');
}

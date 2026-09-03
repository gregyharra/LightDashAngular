import { Component, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'dpf-icon-button',
  imports: [MatButtonModule, MatIconModule],
  host: {
    class: 'dpf-icon-button',
    '[class.dpf-icon-button--ai]': "tone() === 'ai'",
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
      border: 1px solid var(--ld-color-border);
      border-radius: 50%;
      background: var(--ld-color-bg);
      color: var(--ld-color-muted);
    }

    button:hover {
      background: var(--ld-color-surface);
      color: var(--ld-color-brand);
    }

    mat-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      font-size: 18px;
      line-height: 1;
      overflow: hidden;
    }

    :host(.dpf-icon-button--ai) button {
      color: var(--ld-color-ai);
    }
  `,
})
export class DpfIconButtonComponent {
  readonly icon = input.required<string>();
  readonly ariaLabel = input.required<string>();
  readonly disabled = input(false);
  readonly tone = input<'default' | 'ai'>('default');
}

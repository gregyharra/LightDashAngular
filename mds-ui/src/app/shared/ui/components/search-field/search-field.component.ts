import { Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'dpf-search-field',
  imports: [MatIconModule, MatProgressSpinnerModule],
  host: {
    class: 'dpf-search-field',
  },
  template: `
    <mat-icon class="dpf-search-field__icon">search</mat-icon>
    <input
      type="search"
      [value]="value()"
      [placeholder]="placeholder()"
      [attr.aria-label]="ariaLabel()"
      (input)="onInput($event)"
      (focus)="focused.emit()"
      (keydown)="keydownEvent.emit($event)"
    />
    @if (loading()) {
      <mat-spinner diameter="16" />
    }
    <ng-content />
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: var(--ld-space-xs);
      min-width: 0;
      height: 40px;
      padding: 0 var(--ld-space-sm);
      border: 1px solid var(--ld-color-border);
      border-radius: var(--ld-radius-pill);
      background: var(--ld-color-surface);
      color: var(--ld-color-muted);
    }

    :host(:focus-within) {
      border-color: var(--ld-color-brand);
    }

    .dpf-search-field__icon,
    mat-spinner {
      flex-shrink: 0;
    }

    input {
      flex: 1 1 auto;
      min-width: 0;
      border: 0;
      outline: 0;
      background: transparent;
      color: var(--ld-color-fg);
      font: inherit;
    }

    input::placeholder {
      color: var(--ld-color-muted);
    }
  `,
})
export class DpfSearchFieldComponent {
  readonly value = input('');
  readonly placeholder = input('');
  readonly ariaLabel = input.required<string>();
  readonly loading = input(false);

  readonly valueChange = output<string>();
  readonly focused = output<void>();
  readonly keydownEvent = output<KeyboardEvent>();

  protected onInput(event: Event): void {
    this.valueChange.emit((event.target as HTMLInputElement).value);
  }
}

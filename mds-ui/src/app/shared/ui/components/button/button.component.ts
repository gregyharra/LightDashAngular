import { Component, computed, input } from '@angular/core';
import { MatButtonAppearance, MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

export type DpfButtonVariant = 'filled' | 'outlined' | 'text';
export type DpfButtonTone = 'primary' | 'neutral';

@Component({
  selector: 'dpf-button',
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  host: {
    class: 'dpf-button',
    '[class.dpf-button--filled]': "variant() === 'filled'",
    '[class.dpf-button--outlined]': "variant() === 'outlined'",
    '[class.dpf-button--text]': "variant() === 'text'",
    '[class.dpf-button--primary]': "tone() === 'primary'",
    '[class.dpf-button--neutral]': "tone() === 'neutral'",
  },
  template: `
    <!--
      Single content row we own: Material's icon/label slots fight optical
      centering, so icon + label live in one flex cluster with equal padding.
    -->
    <button
      [matButton]="matAppearance()"
      [type]="type()"
      [disabled]="disabled() || loading()"
      [attr.aria-pressed]="ariaPressed()"
    >
      <span class="dpf-button__content">
        @if (loading()) {
          <mat-spinner diameter="16" />
        } @else if (icon(); as iconName) {
          <mat-icon class="dpf-button__icon" aria-hidden="true">{{ iconName }}</mat-icon>
        }
        <span class="dpf-button__label"><ng-content /></span>
      </span>
    </button>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex-shrink: 0;
      white-space: nowrap;

      --mdc-filled-button-container-height: var(--ld-button-height);
      --mdc-outlined-button-container-height: var(--ld-button-height);
      --mdc-text-button-container-height: var(--ld-button-height);
      --mdc-protected-button-container-height: var(--ld-button-height);
      --mat-button-filled-container-height: var(--ld-button-height);
      --mat-button-outlined-container-height: var(--ld-button-height);
      --mat-button-text-container-height: var(--ld-button-height);
      --mat-button-tonal-container-height: var(--ld-button-height);
      --mat-button-protected-container-height: var(--ld-button-height);
    }

    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      height: var(--ld-button-height);
      min-height: var(--ld-button-height);
      margin: 0;
      /* Full shorthand resets Material's asymmetric / token padding. */
      padding: 0 var(--ld-button-padding-inline);
      border-radius: var(--ld-radius-md);
      line-height: 1;
      letter-spacing: normal;
      white-space: nowrap;
    }

    /* Own flex cluster (in template). Pierce MDC label wrapper Material injects. */
    .dpf-button__content,
    .dpf-button__label {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--ld-button-gap);
      margin: 0;
      padding: 0;
      line-height: 1;
    }

    :host ::ng-deep .mdc-button__label {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--ld-button-gap);
      margin: 0;
      padding: 0;
      line-height: 1;
    }

    :host ::ng-deep .mat-icon {
      margin: 0;
    }

    :host(.dpf-button--primary.dpf-button--filled) button {
      background: var(--ld-color-brand);
      color: var(--ld-color-on-brand);
    }

    :host(.dpf-button--primary.dpf-button--outlined) button {
      border-color: var(--ld-color-brand);
      color: var(--ld-color-brand);
    }

    :host(.dpf-button--primary.dpf-button--text) button {
      color: var(--ld-color-brand);
    }

    :host(.dpf-button--neutral) button {
      color: var(--ld-color-fg);
    }

    :host(.dpf-button--neutral.dpf-button--filled) button {
      background: var(--ld-color-surface);
    }

    :host(.dpf-button--neutral.dpf-button--outlined) button {
      border-color: var(--ld-color-border);
    }

    mat-spinner,
    .dpf-button__icon {
      flex-shrink: 0;
      margin: 0;
    }

    .dpf-button__icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: var(--ld-button-icon-size);
      height: var(--ld-button-icon-size);
      font-size: var(--ld-button-icon-size);
      line-height: var(--ld-button-icon-size);
      overflow: hidden;
    }
  `,
})
export class DpfButtonComponent {
  readonly variant = input<DpfButtonVariant>('filled');
  readonly tone = input<DpfButtonTone>('primary');
  readonly disabled = input(false);
  readonly loading = input(false);
  readonly type = input<'button' | 'submit'>('button');
  readonly icon = input<string | null>(null);
  readonly ariaPressed = input<boolean | null>(null);

  protected readonly matAppearance = computed<MatButtonAppearance>(() => {
    switch (this.variant()) {
      case 'outlined':
        return 'outlined';
      case 'text':
        return 'text';
      default:
        return 'filled';
    }
  });
}

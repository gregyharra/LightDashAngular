import { NgTemplateOutlet } from '@angular/common';
import { Component, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

export type LdButtonVariant = 'filled' | 'outlined' | 'text';
export type LdButtonTone = 'primary' | 'neutral';

@Component({
  selector: 'ld-button',
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule, NgTemplateOutlet],
  host: {
    class: 'ld-button',
    '[class.ld-button--filled]': "variant() === 'filled'",
    '[class.ld-button--outlined]': "variant() === 'outlined'",
    '[class.ld-button--text]': "variant() === 'text'",
    '[class.ld-button--primary]': "tone() === 'primary'",
    '[class.ld-button--neutral]': "tone() === 'neutral'",
  },
  template: `
    @if (variant() === 'filled') {
      <button
        mat-flat-button
        [type]="type()"
        [disabled]="disabled() || loading()"
        [attr.aria-pressed]="ariaPressed()"
      >
        <ng-container *ngTemplateOutlet="content" />
      </button>
    } @else if (variant() === 'outlined') {
      <button
        mat-stroked-button
        [type]="type()"
        [disabled]="disabled() || loading()"
        [attr.aria-pressed]="ariaPressed()"
      >
        <ng-container *ngTemplateOutlet="content" />
      </button>
    } @else {
      <button
        mat-button
        [type]="type()"
        [disabled]="disabled() || loading()"
        [attr.aria-pressed]="ariaPressed()"
      >
        <ng-container *ngTemplateOutlet="content" />
      </button>
    }

    <ng-template #content>
      @if (loading()) {
        <mat-spinner diameter="16" />
      } @else if (icon(); as iconName) {
        <mat-icon>{{ iconName }}</mat-icon>
      }
      <ng-content />
    </ng-template>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex-shrink: 0;
      white-space: nowrap;
    }

    button {
      gap: var(--ld-space-xs);
      border-radius: var(--ld-radius-md);
      white-space: nowrap;
    }

    :host(.ld-button--primary.ld-button--filled) button {
      background: var(--ld-color-brand);
      color: var(--ld-color-on-brand);
    }

    :host(.ld-button--primary.ld-button--outlined) button {
      border-color: var(--ld-color-brand);
      color: var(--ld-color-brand);
    }

    :host(.ld-button--primary.ld-button--text) button {
      color: var(--ld-color-brand);
    }

    :host(.ld-button--neutral) button {
      color: var(--ld-color-fg);
    }

    :host(.ld-button--neutral.ld-button--filled) button {
      background: var(--ld-color-surface);
    }

    :host(.ld-button--neutral.ld-button--outlined) button {
      border-color: var(--ld-color-border);
    }

    mat-spinner,
    mat-icon {
      flex-shrink: 0;
    }
  `,
})
export class LdButtonComponent {
  readonly variant = input<LdButtonVariant>('filled');
  readonly tone = input<LdButtonTone>('primary');
  readonly disabled = input(false);
  readonly loading = input(false);
  readonly type = input<'button' | 'submit'>('button');
  readonly icon = input<string | null>(null);
  readonly ariaPressed = input<boolean | null>(null);
}

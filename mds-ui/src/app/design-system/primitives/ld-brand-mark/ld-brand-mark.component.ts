import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'ld-brand-mark',
  imports: [RouterLink],
  host: {
    class: 'ld-brand-mark',
  },
  template: `
    @if (routerLink(); as destination) {
      <a
        class="ld-brand-mark__content"
        [routerLink]="destination"
        [attr.aria-label]="ariaLabel()"
        [attr.title]="title()"
      >
        <img [src]="markSrc()" alt="" />
        @if (showWordmark()) {
          <span class="ld-brand-mark__wordmark"><em>{{ lead() }}</em>{{ trail() }}</span>
        }
      </a>
    } @else {
      <span
        class="ld-brand-mark__content"
        role="img"
        [attr.aria-label]="ariaLabel()"
        [attr.title]="title()"
      >
        <img [src]="markSrc()" alt="" />
        @if (showWordmark()) {
          <span class="ld-brand-mark__wordmark"><em>{{ lead() }}</em>{{ trail() }}</span>
        }
      </span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      min-width: 0;
    }

    .ld-brand-mark__content {
      display: inline-flex;
      align-items: center;
      gap: var(--ld-space-xs);
      min-width: 0;
      color: var(--ld-color-fg);
      text-decoration: none;
    }

    img {
      display: block;
      flex-shrink: 0;
      width: 28px;
      height: 28px;
    }

    .ld-brand-mark__wordmark {
      white-space: nowrap;
    }

    em {
      color: var(--ld-color-brand);
      font-style: normal;
      font-weight: 700;
    }

    @media (max-width: 480px) {
      .ld-brand-mark__wordmark {
        display: none;
      }
    }
  `,
})
export class LdBrandMarkComponent {
  readonly showWordmark = input(true);
  readonly routerLink = input<string | any[] | null>('/projects');
  readonly markSrc = input('assets/brand-mark.svg');
  readonly ariaLabel = input.required<string>();
  readonly title = input<string | null>(null);
  readonly lead = input.required<string>();
  readonly trail = input.required<string>();
}

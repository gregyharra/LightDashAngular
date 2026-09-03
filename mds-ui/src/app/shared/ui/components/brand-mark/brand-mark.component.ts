import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'dpf-brand-mark',
  imports: [RouterLink],
  host: {
    class: 'dpf-brand-mark',
  },
  template: `
    @if (routerLink(); as destination) {
      <a
        class="dpf-brand-mark__content"
        [routerLink]="destination"
        [attr.aria-label]="ariaLabel()"
        [attr.title]="title()"
      >
        <img [src]="markSrc()" alt="" />
        @if (showWordmark()) {
          <span class="dpf-brand-mark__wordmark"><em>{{ lead() }}</em>{{ trail() }}</span>
        }
      </a>
    } @else {
      <span
        class="dpf-brand-mark__content"
        role="img"
        [attr.aria-label]="ariaLabel()"
        [attr.title]="title()"
      >
        <img [src]="markSrc()" alt="" />
        @if (showWordmark()) {
          <span class="dpf-brand-mark__wordmark"><em>{{ lead() }}</em>{{ trail() }}</span>
        }
      </span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      min-width: 0;
    }

    .dpf-brand-mark__content {
      display: inline-flex;
      align-items: center;
      gap: var(--ld-space-xs);
      min-width: 0;
      color: var(--ld-color-brand);
      text-decoration: none;
    }

    img {
      display: block;
      flex-shrink: 0;
      width: 34px;
      height: 34px;
    }

    .dpf-brand-mark__wordmark {
      overflow: hidden;
      font-size: 1.15rem;
      font-weight: 700;
      letter-spacing: -0.01em;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    em {
      color: var(--ld-color-fg);
      font-style: normal;
    }

    @media (max-width: 480px) {
      .dpf-brand-mark__wordmark {
        display: none;
      }
    }
  `,
})
export class DpfBrandMarkComponent {
  readonly showWordmark = input(true);
  readonly routerLink = input<string | any[] | null>('/projects');
  readonly markSrc = input('assets/brand-mark.svg');
  readonly ariaLabel = input.required<string>();
  readonly title = input<string | null>(null);
  readonly lead = input.required<string>();
  readonly trail = input.required<string>();
}

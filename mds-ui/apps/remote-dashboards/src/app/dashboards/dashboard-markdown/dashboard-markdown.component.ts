import { Component, computed, input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { inject } from '@angular/core';

@Component({
  selector: 'app-dashboard-markdown',
  template: `<div class="dashboard-markdown" [innerHTML]="rendered()"></div>`,
  styles: `
    :host {
      display: block;
    }

    .dashboard-markdown {
      font-size: var(--ld-font-size-sm);
      line-height: 1.6;
      color: var(--ld-gray-7);
    }

    :host ::ng-deep .dashboard-markdown__link {
      color: var(--ld-blue-6);
      text-decoration: none;
      font-weight: 500;

      &:hover {
        text-decoration: underline;
      }
    }
  `,
})
export class DashboardMarkdownComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly content = input.required<string>();

  protected readonly rendered = computed((): SafeHtml => {
    const html = this.renderMarkdown(this.content());
    return this.sanitizer.bypassSecurityTrustHtml(html);
  });

  private renderMarkdown(content: string): string {
    let html = this.escapeHtml(content);

    html = html.replace(
      /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
      '<a class="dashboard-markdown__link" href="$2" target="_blank" rel="noopener">$1</a>',
    );

    html = html.replace(
      /(^|\s)(#[\w-]+)/g,
      '$1<a class="dashboard-markdown__link" href="#">$2</a>',
    );

    html = html.replace(
      /(^|\s)(https?:\/\/[^\s<]+)/g,
      '$1<a class="dashboard-markdown__link" href="$2" target="_blank" rel="noopener">$2</a>',
    );

    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\n/g, '<br />');

    return html;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

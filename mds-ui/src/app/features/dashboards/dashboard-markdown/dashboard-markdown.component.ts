import { Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-dashboard-markdown',
  template: `<div class="dashboard-markdown" [innerHTML]="rendered()"></div>`,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }

    .dashboard-markdown {
      font-size: var(--ld-font-size-sm);
      line-height: 1.6;
      color: var(--ld-gray-7);
      word-break: break-word;
    }

    :host ::ng-deep {
      .dashboard-markdown__h1,
      .dashboard-markdown__h2,
      .dashboard-markdown__h3 {
        margin: 0 0 0.5em;
        color: var(--ld-gray-9);
        font-weight: 650;
        line-height: 1.3;
      }

      .dashboard-markdown__h1 {
        font-size: 1.35em;
      }

      .dashboard-markdown__h2 {
        font-size: 1.2em;
      }

      .dashboard-markdown__h3 {
        font-size: 1.05em;
      }

      .dashboard-markdown__p {
        margin: 0 0 0.75em;
      }

      .dashboard-markdown__p:last-child {
        margin-bottom: 0;
      }

      .dashboard-markdown__ul,
      .dashboard-markdown__ol {
        margin: 0 0 0.75em;
        padding-left: 1.25em;
      }

      .dashboard-markdown__li {
        margin: 0.15em 0;
      }

      .dashboard-markdown__quote {
        margin: 0 0 0.75em;
        padding: 0.25em 0.75em;
        border-left: 3px solid var(--ld-gray-3);
        color: var(--ld-gray-6);
      }

      .dashboard-markdown__hr {
        margin: 0.85em 0;
        border: none;
        border-top: 1px solid var(--ld-gray-3);
      }

      .dashboard-markdown__code {
        padding: 0.1em 0.35em;
        border-radius: 4px;
        background: var(--ld-gray-1);
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 0.92em;
      }

      .dashboard-markdown__pre {
        margin: 0 0 0.75em;
        padding: 0.65em 0.75em;
        overflow-x: auto;
        border-radius: var(--ld-radius-md);
        background: var(--ld-gray-1);
      }

      .dashboard-markdown__pre .dashboard-markdown__code {
        padding: 0;
        background: transparent;
      }

      .dashboard-markdown__link {
        color: var(--ld-blue-6);
        text-decoration: none;
        font-weight: 500;
      }

      .dashboard-markdown__link:hover {
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
    const escaped = this.escapeHtml(content);
    const blocks = escaped.replace(/\r\n/g, '\n').split(/\n{2,}/);

    return blocks
      .map((block) => this.renderBlock(block.trim()))
      .filter(Boolean)
      .join('');
  }

  private renderBlock(block: string): string {
    if (!block) {
      return '';
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(block)) {
      return '<hr class="dashboard-markdown__hr" />';
    }

    const heading = block.match(/^(#{1,3})\s+(.+)$/s);
    if (heading) {
      const level = heading[1].length;
      return `<h${level} class="dashboard-markdown__h${level}">${this.renderInline(heading[2].trim())}</h${level}>`;
    }

    if (/^>\s?/m.test(block)) {
      const quote = block
        .split('\n')
        .map((line) => line.replace(/^>\s?/, ''))
        .join('<br />');
      return `<blockquote class="dashboard-markdown__quote">${this.renderInline(quote)}</blockquote>`;
    }

    if (/^```/.test(block)) {
      const code = block.replace(/^```[^\n]*\n?/, '').replace(/\n?```$/, '');
      return `<pre class="dashboard-markdown__pre"><code class="dashboard-markdown__code">${code}</code></pre>`;
    }

    const lines = block.split('\n');
    if (lines.every((line) => /^[-*]\s+/.test(line))) {
      const items = lines
        .map((line) => `<li class="dashboard-markdown__li">${this.renderInline(line.replace(/^[-*]\s+/, ''))}</li>`)
        .join('');
      return `<ul class="dashboard-markdown__ul">${items}</ul>`;
    }

    if (lines.every((line) => /^\d+\.\s+/.test(line))) {
      const items = lines
        .map((line) => `<li class="dashboard-markdown__li">${this.renderInline(line.replace(/^\d+\.\s+/, ''))}</li>`)
        .join('');
      return `<ol class="dashboard-markdown__ol">${items}</ol>`;
    }

    return `<p class="dashboard-markdown__p">${this.renderInline(lines.join('<br />'))}</p>`;
  }

  private renderInline(content: string): string {
    let html = content;

    html = html.replace(
      /`([^`]+)`/g,
      '<code class="dashboard-markdown__code">$1</code>',
    );

    html = html.replace(
      /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
      '<a class="dashboard-markdown__link" href="$2" target="_blank" rel="noopener">$1</a>',
    );

    html = html.replace(
      /(^|[\s>(])(#[\w-]+)/g,
      '$1<a class="dashboard-markdown__link" href="#">$2</a>',
    );

    html = html.replace(
      /(^|[\s>(])(https?:\/\/[^\s<]+)/g,
      '$1<a class="dashboard-markdown__link" href="$2" target="_blank" rel="noopener">$2</a>',
    );

    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1<em>$2</em>');
    html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');

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

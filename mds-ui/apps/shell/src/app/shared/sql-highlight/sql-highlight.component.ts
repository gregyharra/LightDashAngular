import { Component, computed, input } from '@angular/core';
import { tokenizeSql } from './sql-tokenizer';

@Component({
  selector: 'app-sql-highlight',
  templateUrl: './sql-highlight.component.html',
  styleUrl: './sql-highlight.component.scss',
})
export class SqlHighlightComponent {
  /** SQL (or dbt/Jinja SQL) source to highlight. */
  readonly sql = input<string | null | undefined>('');

  /** Optional accessible label for the code block. */
  readonly ariaLabel = input('SQL');

  protected readonly tokens = computed(() => tokenizeSql(this.sql() ?? ''));

  protected tokenClass(type: string): string | null {
    return type === 'plain' ? null : `sql-highlight__${type}`;
  }
}

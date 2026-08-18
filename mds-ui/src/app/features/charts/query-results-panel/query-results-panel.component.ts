import { Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-query-results-panel',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatTooltipModule,
  ],
  templateUrl: './query-results-panel.component.html',
  styleUrl: './query-results-panel.component.scss',
})
export class QueryResultsPanelComponent {
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly hasResultsObject = input(false);
  readonly rows = input<Record<string, string>[]>([]);
  readonly displayedColumns = input<string[]>([]);
  readonly columnLabel = input.required<(column: string) => string>();
  readonly isMetric = input.required<(column: string) => boolean>();
  readonly pageIndex = input(0);
  readonly pageSize = input(25);
  readonly pageSizeOptions = input<number[]>([10, 25, 50, 100]);
  readonly showExport = input(false);
  readonly exportDisabled = input(false);

  readonly page = output<PageEvent>();
  readonly exportCsv = output<void>();
  readonly exportXlsx = output<void>();

  protected readonly clampedPageIndex = computed(() => {
    const rows = this.rows();
    const pageSize = this.pageSize();
    const maxPage = Math.max(0, Math.ceil(rows.length / pageSize) - 1);
    return Math.min(this.pageIndex(), maxPage);
  });

  protected readonly pagedRows = computed(() => {
    const pageSize = this.pageSize();
    const start = this.clampedPageIndex() * pageSize;
    return this.rows().slice(start, start + pageSize);
  });
}

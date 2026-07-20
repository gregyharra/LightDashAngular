import { Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { QueryWarning } from '../../core/models/explore.model';

@Component({
  selector: 'app-query-warnings-banner',
  imports: [MatIconModule],
  templateUrl: './query-warnings-banner.component.html',
  styleUrl: './query-warnings-banner.component.scss',
})
export class QueryWarningsBannerComponent {
  readonly warnings = input<QueryWarning[]>([]);

  protected readonly visibleWarnings = computed(() =>
    this.warnings().filter((warning) => warning.message.trim().length > 0),
  );

  protected iconForSeverity(severity: QueryWarning['severity']): string {
    switch (severity) {
      case 'error':
        return 'error_outline';
      case 'warning':
        return 'warning_amber';
      default:
        return 'info_outline';
    }
  }
}

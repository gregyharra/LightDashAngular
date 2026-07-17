import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActiveProjectService } from '../../../core/services/active-project.service';
import { SavedChartBasic } from '../../../core/models/chart.model';
import { ChartService } from '../chart.service';
import { ResizableSidebarDirective } from '../../../layout/resizable-sidebar/resizable-sidebar.directive';

const CHART_KIND_LABELS: Record<string, string> = {
  vertical_bar: 'Bar',
  horizontal_bar: 'Horizontal bar',
  line: 'Line',
  pie: 'Pie',
  table: 'Table',
};

@Component({
  selector: 'app-charts-list-page',
  imports: [
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    ResizableSidebarDirective,
  ],
  templateUrl: './charts-list-page.component.html',
  styleUrl: './charts-list-page.component.scss',
})
export class ChartsListPageComponent {
  private readonly chartService = inject(ChartService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly activeProjectService = inject(ActiveProjectService);

  protected readonly projectUuid = signal<string | null>(null);
  protected readonly charts = signal<SavedChartBasic[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const projectUuid = params.get('projectUuid');
      if (!projectUuid) {
        return;
      }

      this.projectUuid.set(projectUuid);
      this.activeProjectService.setActiveProject(projectUuid);
      this.loadCharts(projectUuid);
    });
  }

  private loadCharts(projectUuid: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.chartService.list(projectUuid).subscribe({
      next: (charts) => {
        this.charts.set(charts);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load charts.');
        this.loading.set(false);
      },
    });
  }

  protected formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  protected chartKindLabel(kind: string): string {
    return CHART_KIND_LABELS[kind] ?? kind;
  }

  protected openChart(chartUuid: string): void {
    const projectUuid = this.projectUuid();
    if (!projectUuid) {
      return;
    }

    void this.router.navigate(['/projects', projectUuid, 'charts', chartUuid]);
  }
}

import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActiveProjectService } from '../../../core/services/active-project.service';
import { DashboardBasicDetailsWithTileTypes } from '../../../core/models/dashboard.model';
import { DashboardService } from '../dashboard.service';

@Component({
  selector: 'app-dashboards-list-page',
  imports: [
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './dashboards-list-page.component.html',
  styleUrl: './dashboards-list-page.component.scss',
})
export class DashboardsListPageComponent {
  private readonly dashboardService = inject(DashboardService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly activeProjectService = inject(ActiveProjectService);

  protected readonly projectUuid = signal<string | null>(null);
  protected readonly dashboards = signal<DashboardBasicDetailsWithTileTypes[]>([]);
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
      this.loadDashboards(projectUuid);
    });
  }

  private loadDashboards(projectUuid: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.dashboardService.list(projectUuid).subscribe({
      next: (dashboards) => {
        this.dashboards.set(dashboards);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load dashboards.');
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

  protected openDashboard(dashboardUuid: string): void {
    const projectUuid = this.projectUuid();
    if (!projectUuid) {
      return;
    }

    void this.router.navigate([
      '/projects',
      projectUuid,
      'dashboards',
      dashboardUuid,
    ]);
  }
}

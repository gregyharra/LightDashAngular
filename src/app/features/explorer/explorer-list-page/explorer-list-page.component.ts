import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActiveProjectService } from '../../../core/services/active-project.service';
import { ExploreSummary } from '../../../core/models/explore.model';
import { ExplorerService } from '../explorer.service';
import { ResizableSidebarDirective } from '../../../layout/resizable-sidebar/resizable-sidebar.directive';

@Component({
  selector: 'app-explorer-list-page',
  imports: [
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    ResizableSidebarDirective,
  ],
  templateUrl: './explorer-list-page.component.html',
  styleUrl: './explorer-list-page.component.scss',
})
export class ExplorerListPageComponent {
  private readonly explorerService = inject(ExplorerService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly activeProjectService = inject(ActiveProjectService);

  protected readonly projectUuid = signal<string | null>(null);
  protected readonly explores = signal<ExploreSummary[]>([]);
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
      this.loadExplores(projectUuid);
    });
  }

  private loadExplores(projectUuid: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.explorerService.listExplores(projectUuid).subscribe({
      next: (explores) => {
        this.explores.set(explores);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load explores.');
        this.loading.set(false);
      },
    });
  }

  protected openExplore(tableId: string): void {
    const projectUuid = this.projectUuid();
    if (!projectUuid) {
      return;
    }

    void this.router.navigate([
      '/projects',
      projectUuid,
      'tables',
      tableId,
    ]);
  }
}

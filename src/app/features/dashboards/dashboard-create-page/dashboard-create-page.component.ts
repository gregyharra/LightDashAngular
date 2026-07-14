import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { apiErrorMessage } from '../../../core/api/lightdash-api.service';
import { Space } from '../../../core/models/space.model';
import { ActiveProjectService } from '../../../core/services/active-project.service';
import { SpaceService } from '../../spaces/space.service';
import { DashboardService } from '../dashboard.service';
import { ResizableSidebarDirective } from '../../../layout/resizable-sidebar/resizable-sidebar.directive';

@Component({
  selector: 'app-dashboard-create-page',
  imports: [
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    ResizableSidebarDirective,
  ],
  templateUrl: './dashboard-create-page.component.html',
  styleUrl: './dashboard-create-page.component.scss',
})
export class DashboardCreatePageComponent {
  private readonly dashboardService = inject(DashboardService);
  private readonly spaceService = inject(SpaceService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly activeProjectService = inject(ActiveProjectService);

  protected readonly projectUuid = signal<string | null>(null);
  protected readonly spaces = signal<Space[]>([]);
  protected readonly spacesLoading = signal(true);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected name = '';
  protected description = '';
  protected spaceUuid = '';

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const projectUuid = params.get('projectUuid');
      if (!projectUuid) {
        return;
      }

      this.projectUuid.set(projectUuid);
      this.activeProjectService.setActiveProject(projectUuid);
      this.loadSpaces(projectUuid);
    });
  }

  private loadSpaces(projectUuid: string): void {
    this.spacesLoading.set(true);

    this.spaceService.list(projectUuid).subscribe({
      next: (spaces) => {
        this.spaces.set(spaces);
        this.spaceUuid = spaces[0]?.uuid ?? '';
        this.spacesLoading.set(false);
      },
      error: () => {
        this.spaces.set([]);
        this.spacesLoading.set(false);
      },
    });
  }

  protected cancel(): void {
    const projectUuid = this.projectUuid();
    if (!projectUuid) {
      return;
    }

    void this.router.navigate(['/projects', projectUuid, 'dashboards']);
  }

  protected submit(): void {
    const projectUuid = this.projectUuid();
    const trimmedName = this.name.trim();

    if (!projectUuid || !trimmedName || this.submitting()) {
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    this.dashboardService
      .create(projectUuid, {
        name: trimmedName,
        description: this.description.trim() || undefined,
        spaceUuid: this.spaceUuid || undefined,
      })
      .subscribe({
        next: (dashboard) => {
          void this.router.navigate([
            '/projects',
            projectUuid,
            'dashboards',
            dashboard.uuid,
          ]);
        },
        error: (err) => {
          this.error.set(apiErrorMessage(err));
          this.submitting.set(false);
        },
      });
  }
}

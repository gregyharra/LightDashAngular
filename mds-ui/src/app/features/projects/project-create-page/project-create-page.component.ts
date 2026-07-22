import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { apiErrorMessage } from '../../../core/api/lightdash-api.service';
import { GitProvider } from '../../../core/models/project.model';
import { WarehouseListItem } from '../../../core/models/warehouse.model';
import { ActiveProjectService } from '../../../core/services/active-project.service';
import { ResizableSidebarDirective } from '../../../layout/resizable-sidebar/resizable-sidebar.directive';
import { SettingsSidebarNavComponent } from '../../../layout/settings-sidebar-nav/settings-sidebar-nav.component';
import { WarehouseCreateDialogComponent } from '../../warehouses/warehouse-create-dialog/warehouse-create-dialog.component';
import { ProjectsService } from '../projects.service';
import { WarehouseService } from '../warehouse.service';

@Component({
  selector: 'app-project-create-page',
  imports: [
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    ResizableSidebarDirective,
    SettingsSidebarNavComponent,
  ],
  templateUrl: './project-create-page.component.html',
  styleUrl: './project-create-page.component.scss',
})
export class ProjectCreatePageComponent {
  private readonly projectsService = inject(ProjectsService);
  private readonly warehouseService = inject(WarehouseService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  protected readonly activeProjectService = inject(ActiveProjectService);

  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly warehouses = signal<WarehouseListItem[]>([]);

  protected name = '';
  protected selectedWarehouseUuid: string | null = null;
  protected gitRepoUrl = '';
  protected gitDefaultBranch = 'main';
  protected gitProvider: GitProvider | null = null;
  protected gitSubdirectory = '';
  protected gitToken = '';
  protected dbtProjectPath = '';

  protected readonly gitProviders: { value: GitProvider; label: string }[] = [
    { value: 'github', label: 'GitHub' },
    { value: 'gitlab', label: 'GitLab' },
    { value: 'bitbucket', label: 'Bitbucket' },
    { value: 'generic', label: 'Generic HTTPS' },
  ];

  constructor() {
    this.loadWarehouses();
  }

  private loadWarehouses(): void {
    this.warehouseService.list().subscribe({
      next: (warehouses) => {
        this.warehouses.set(warehouses);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(apiErrorMessage(err));
        this.loading.set(false);
      },
    });
  }

  protected openCreateWarehouseDialog(): void {
    const dialogRef = this.dialog.open(WarehouseCreateDialogComponent, {
      width: '720px',
      panelClass: 'warehouse-create-dialog-panel',
      data: {
        suggestedName: this.name ? `${this.name} warehouse` : undefined,
      },
    });

    dialogRef.afterClosed().subscribe((warehouse) => {
      if (!warehouse) {
        return;
      }

      this.warehouses.update((items) => [
        ...items,
        {
          warehouseUuid: warehouse.warehouseUuid,
          name: warehouse.name,
          type: warehouse.type,
          host: warehouse.host,
          port: warehouse.port,
          catalog: warehouse.catalog,
          schema: warehouse.schema,
          hasPassword: warehouse.hasPassword,
          updatedAt: warehouse.updatedAt,
        },
      ]);
      this.selectedWarehouseUuid = warehouse.warehouseUuid;
    });
  }

  protected cancel(): void {
    void this.router.navigate(['/projects']);
  }

  protected submit(): void {
    const trimmedName = this.name.trim();
    if (!trimmedName || this.submitting()) {
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    this.projectsService
      .create({
        name: trimmedName,
        warehouseUuid: this.selectedWarehouseUuid,
        gitRepoUrl: this.gitRepoUrl.trim() || null,
        gitDefaultBranch: this.gitDefaultBranch.trim() || 'main',
        gitProvider: this.gitProvider,
        gitSubdirectory: this.gitSubdirectory.trim() || null,
        gitToken: this.gitToken.trim() || null,
        dbtProjectPath: this.dbtProjectPath.trim() || null,
      })
      .subscribe({
        next: (project) => {
          const currentProjects = this.activeProjectService.projects();
          this.activeProjectService.setProjects([...currentProjects, project]);
          this.activeProjectService.setActiveProject(project.projectUuid);
          void this.router.navigate(['/projects', project.projectUuid, 'dashboards']);
        },
        error: (err) => {
          this.error.set(apiErrorMessage(err));
          this.submitting.set(false);
        },
      });
  }
}

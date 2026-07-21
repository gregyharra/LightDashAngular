import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { apiErrorMessage } from '../../../core/api/lightdash-api.service';
import { WarehouseListItem } from '../../../core/models/warehouse.model';
import { ActiveProjectService } from '../../../core/services/active-project.service';
import { ResizableSidebarDirective } from '../../../layout/resizable-sidebar/resizable-sidebar.directive';
import { SettingsSidebarNavComponent } from '../../../layout/settings-sidebar-nav/settings-sidebar-nav.component';
import { ProjectDetail, ProjectsService } from '../projects.service';
import { WarehouseService } from '../warehouse.service';
import { WarehouseCreateDialogComponent } from '../../warehouses/warehouse-create-dialog/warehouse-create-dialog.component';

@Component({
  selector: 'app-project-edit-page',
  imports: [
    RouterLink,
    FormsModule,
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
  templateUrl: './project-edit-page.component.html',
  styleUrl: './project-edit-page.component.scss',
})
export class ProjectEditPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly projectsService = inject(ProjectsService);
  private readonly warehouseService = inject(WarehouseService);
  private readonly dialog = inject(MatDialog);
  protected readonly activeProjectService = inject(ActiveProjectService);

  protected readonly projectUuid = signal<string | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);
  protected readonly warehouses = signal<WarehouseListItem[]>([]);

  protected name = '';
  protected selectedWarehouseUuid: string | null = null;

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const projectUuid = params.get('projectUuid');
      if (!projectUuid) {
        return;
      }

      this.projectUuid.set(projectUuid);
      this.activeProjectService.setActiveProject(projectUuid);
      this.loadPage(projectUuid);
    });
  }

  private loadPage(projectUuid: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.projectsService.get(projectUuid).subscribe({
      next: (project) => {
        this.applyProject(project);
        this.loadWarehouses();
      },
      error: (err) => {
        this.error.set(apiErrorMessage(err));
        this.loading.set(false);
      },
    });
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

  private applyProject(project: ProjectDetail): void {
    this.name = project.name;
    this.selectedWarehouseUuid = project.warehouseUuid ?? null;
    this.activeProjectService.setProjects(
      this.activeProjectService.projects().map((item) =>
        item.projectUuid === project.projectUuid
          ? { ...item, name: project.name, warehouseUuid: project.warehouseUuid ?? null }
          : item,
      ),
    );
  }

  protected openCreateWarehouseDialog(): void {
    const dialogRef = this.dialog.open(WarehouseCreateDialogComponent, {
      width: '720px',
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

  protected save(): void {
    const projectUuid = this.projectUuid();
    if (!projectUuid) {
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);

    this.projectsService
      .update(projectUuid, {
        name: this.name.trim(),
        warehouseUuid: this.selectedWarehouseUuid,
      })
      .subscribe({
        next: (project) => {
          this.applyProject(project);
          this.activeProjectService.setProjects(
            this.activeProjectService.projects().map((item) =>
              item.projectUuid === project.projectUuid
                ? {
                    ...item,
                    name: project.name,
                    warehouseUuid: project.warehouseUuid ?? null,
                    warehouseName: project.warehouseName ?? null,
                  }
                : item,
            ),
          );
          this.saving.set(false);
          this.success.set('Project settings saved.');
        },
        error: (err) => {
          this.error.set(apiErrorMessage(err));
          this.saving.set(false);
        },
      });
  }

  protected cancel(): void {
    void this.router.navigate(['/projects']);
  }
}

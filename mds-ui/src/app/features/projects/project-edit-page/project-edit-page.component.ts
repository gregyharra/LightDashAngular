import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { apiErrorMessage } from '../../../core/api/lightdash-api.service';
import { LanguageService } from '../../../core/i18n/language.service';
import {
  GitProvider,
  ProjectRepoStatus,
} from '../../../core/models/project.model';
import { WarehouseListItem } from '../../../core/models/warehouse.model';
import { ActiveProjectService } from '../../../core/services/active-project.service';
import { ProjectDetail, ProjectsService } from '../projects.service';
import { WarehouseService } from '../warehouse.service';
import { WarehouseCreateDialogComponent } from '../../warehouses/warehouse-create-dialog/warehouse-create-dialog.component';
import { detectGitProvider } from '../git-provider.utils';
import { LineageService } from '../../lineage/lineage.service';
import { ProjectLineage } from '../../../core/models/lineage.model';
import { FilterableLinksTableComponent } from '../../tables/filterable-links-table/filterable-links-table.component';
import { LinkDialogComponent } from '../../tables/link-dialog/link-dialog.component';
import { ModelJoinsService } from '../../tables/model-joins.service';
import {
  LinkDialogSavePayload,
  ModelJoinView,
  ModelLinkOption,
} from '../../../core/models/model-join.model';
import {
  DpfButtonComponent,
  DpfPageFrameComponent,
  DpfPageHeaderComponent,
} from '../../../shared/ui';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';

type ProjectSettingsTab = 'configuration' | 'links';

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
    TranslatePipe,
    DpfButtonComponent,
    DpfPageFrameComponent,
    DpfPageHeaderComponent,
    FilterableLinksTableComponent,
    LinkDialogComponent,
  ],
  templateUrl: './project-edit-page.component.html',
  styleUrl: './project-edit-page.component.scss',
})
export class ProjectEditPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly projectsService = inject(ProjectsService);
  private readonly warehouseService = inject(WarehouseService);
  private readonly lineageService = inject(LineageService);
  private readonly modelJoinsService = inject(ModelJoinsService);
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);
  private readonly languageService = inject(LanguageService);
  protected readonly activeProjectService = inject(ActiveProjectService);

  protected readonly projectUuid = signal<string | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly deleting = signal(false);
  protected readonly syncing = signal(false);
  protected readonly desyncing = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);
  protected readonly repoStatus = signal<ProjectRepoStatus | null>(null);
  protected readonly warehouses = signal<WarehouseListItem[]>([]);
  protected readonly activeSettingsTab =
    signal<ProjectSettingsTab>('configuration');
  protected readonly lineage = signal<ProjectLineage | null>(null);
  protected readonly modelJoins = signal<ModelJoinView[]>([]);
  protected readonly linksLoading = signal(false);
  protected readonly showLinkDialog = signal(false);
  protected readonly editingLink = signal<ModelJoinView | null>(null);
  protected readonly linksSaving = signal(false);

  protected name = '';
  protected selectedWarehouseUuid: string | null = null;
  protected gitRepoUrl = '';
  protected gitDefaultBranch = 'main';
  protected gitProvider: GitProvider | null = null;
  protected gitSubdirectory = '';
  protected gitUsername = '';
  protected gitToken = '';
  protected clearGitToken = false;
  protected hasGitToken = false;
  protected dbtProjectPath = '';
  protected dbtTarget = '';
  private providerManuallySet = false;

  protected formatDateTime(iso: string): string {
    return this.languageService.formatDate(iso, {
      dateStyle: 'medium',
      timeStyle: 'medium',
    });
  }

  protected readonly gitProviders: { value: GitProvider; labelKey: string }[] =
    [
      { value: 'github', labelKey: 'projects.git.providers.github' },
      { value: 'gitlab', labelKey: 'projects.git.providers.gitlab' },
      { value: 'bitbucket', labelKey: 'projects.git.providers.bitbucket' },
      { value: 'generic', labelKey: 'projects.git.providers.generic' },
    ];

  protected readonly modelLinkOptions = computed<ModelLinkOption[]>(() => {
    const lineage = this.lineage();
    if (!lineage) {
      return [];
    }
    return lineage.nodes.map((node) => ({
      id: node.id,
      name: node.name,
      columns: (node.columns ?? []).map((column) => ({
        name: column.name,
        type: column.type,
      })),
    }));
  });

  protected readonly linksCount = computed(() => this.modelJoins().length);

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

  protected onGitRepoUrlChange(url: string): void {
    this.gitRepoUrl = url;
    if (this.providerManuallySet) {
      return;
    }
    this.gitProvider = detectGitProvider(url);
  }

  protected onGitProviderChange(provider: GitProvider | null): void {
    this.gitProvider = provider;
    if (provider === null) {
      this.providerManuallySet = false;
      this.gitProvider = detectGitProvider(this.gitRepoUrl);
      return;
    }
    this.providerManuallySet = true;
  }

  private loadPage(projectUuid: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.projectsService.get(projectUuid).subscribe({
      next: (project) => {
        this.applyProject(project);
        this.loadWarehouses();
        this.loadRepoStatus(projectUuid);
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

  private loadRepoStatus(projectUuid: string): void {
    this.projectsService.getRepoStatus(projectUuid).subscribe({
      next: (status) => this.repoStatus.set(status),
      error: () => this.repoStatus.set(null),
    });
  }

  private applyProject(project: ProjectDetail): void {
    this.name = project.name;
    this.selectedWarehouseUuid = project.warehouseUuid ?? null;
    this.gitRepoUrl = project.gitRepoUrl ?? '';
    this.gitDefaultBranch = project.gitDefaultBranch ?? 'main';
    this.gitProvider =
      project.gitProvider ?? detectGitProvider(project.gitRepoUrl ?? '');
    this.gitSubdirectory = project.gitSubdirectory ?? '';
    this.gitUsername = project.gitUsername ?? '';
    this.dbtProjectPath = project.dbtProjectPath ?? '';
    this.dbtTarget = project.dbtTarget ?? '';
    this.hasGitToken = project.hasGitToken ?? false;
    this.gitToken = '';
    this.clearGitToken = false;
    this.providerManuallySet = project.gitProvider != null;
    this.activeProjectService.setProjects(
      this.activeProjectService.projects().map((item) =>
        item.projectUuid === project.projectUuid
          ? {
              ...item,
              name: project.name,
              warehouseUuid: project.warehouseUuid ?? null,
            }
          : item,
      ),
    );
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
        gitRepoUrl: this.gitRepoUrl.trim() || null,
        gitDefaultBranch: this.gitDefaultBranch.trim() || 'main',
        gitProvider: this.gitProvider,
        gitSubdirectory: this.gitSubdirectory.trim() || null,
        gitUsername: this.gitUsername.trim() || null,
        gitToken: this.gitToken.trim() || undefined,
        clearGitToken: this.clearGitToken,
        dbtProjectPath: this.dbtProjectPath.trim() || null,
        dbtTarget: this.dbtTarget.trim() || null,
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
          this.success.set(this.translate.instant('projects.edit.saved'));
          this.loadRepoStatus(projectUuid);
        },
        error: (err) => {
          this.error.set(apiErrorMessage(err));
          this.saving.set(false);
        },
      });
  }

  protected syncRepository(): void {
    const projectUuid = this.projectUuid();
    if (!projectUuid || this.syncing()) {
      return;
    }

    this.syncing.set(true);
    this.error.set(null);
    this.success.set(null);

    this.projectsService.syncRepo(projectUuid).subscribe({
      next: (status) => {
        this.repoStatus.set(status);
        this.syncing.set(false);
        this.success.set(this.translate.instant('projects.git.synced'));
      },
      error: (err) => {
        this.error.set(apiErrorMessage(err));
        this.syncing.set(false);
      },
    });
  }

  protected desyncRepository(): void {
    const projectUuid = this.projectUuid();
    const repo = this.repoStatus();
    if (!projectUuid || !repo?.cloned || this.desyncing()) {
      return;
    }

    const confirmed = confirm(
      this.translate.instant('projects.git.removeConfirm'),
    );
    if (!confirmed) {
      return;
    }

    this.desyncing.set(true);
    this.error.set(null);
    this.success.set(null);

    this.projectsService.desyncRepo(projectUuid).subscribe({
      next: (status) => {
        this.repoStatus.set(status);
        this.desyncing.set(false);
        this.success.set(this.translate.instant('projects.git.removed'));
      },
      error: (err) => {
        this.error.set(apiErrorMessage(err));
        this.desyncing.set(false);
      },
    });
  }

  protected setSettingsTab(tab: ProjectSettingsTab): void {
    this.activeSettingsTab.set(tab);
    if (tab === 'links') {
      this.loadProjectLinks();
    }
  }

  private loadProjectLinks(): void {
    const projectUuid = this.projectUuid();
    if (!projectUuid) {
      return;
    }
    this.linksLoading.set(true);
    if (!this.lineage()) {
      this.lineageService.getProjectLineage(projectUuid).subscribe({
        next: (lineage) => {
          this.lineage.set(lineage);
          this.fetchModelJoins(projectUuid);
        },
        error: () => {
          this.linksLoading.set(false);
        },
      });
      return;
    }
    this.fetchModelJoins(projectUuid);
  }

  private fetchModelJoins(projectUuid: string): void {
    this.modelJoinsService.list(projectUuid).subscribe({
      next: (links) => {
        this.modelJoins.set(links);
        this.linksLoading.set(false);
      },
      error: () => {
        this.modelJoins.set([]);
        this.linksLoading.set(false);
      },
    });
  }

  protected openAddLinkDialog(): void {
    this.editingLink.set(null);
    this.showLinkDialog.set(true);
  }

  protected onEditLink(link: ModelJoinView): void {
    this.editingLink.set(link);
    this.showLinkDialog.set(true);
  }

  protected onDeleteLink(link: ModelJoinView): void {
    const projectUuid = this.projectUuid();
    const linkUuid = link.uuid;
    if (!projectUuid || !linkUuid) {
      return;
    }
    this.dialog
      .open(ConfirmDialogComponent, {
        width: '28rem',
        data: {
          title: this.translate.instant('tables.links.deleteTitle'),
          message: this.translate.instant('tables.links.deleteMessage', {
            source: `${link.sourceModelName}.${link.sourceColumn}`,
            target: `${link.targetModelName}.${link.targetColumn}`,
          }),
          confirmLabel: this.translate.instant('common.delete'),
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.linksSaving.set(true);
        this.modelJoinsService.delete(projectUuid, linkUuid).subscribe({
          next: () => {
            this.linksSaving.set(false);
            this.loadProjectLinks();
          },
          error: () => this.linksSaving.set(false),
        });
      });
  }

  protected onLinkDialogCancelled(): void {
    this.showLinkDialog.set(false);
    this.editingLink.set(null);
  }

  protected onLinkDialogSaved(payload: LinkDialogSavePayload): void {
    const projectUuid = this.projectUuid();
    if (!projectUuid) {
      return;
    }
    this.linksSaving.set(true);
    const request$ = payload.uuid
      ? this.modelJoinsService.update(projectUuid, payload.uuid, payload)
      : this.modelJoinsService.create(projectUuid, payload);
    request$.subscribe({
      next: () => {
        this.linksSaving.set(false);
        this.showLinkDialog.set(false);
        this.editingLink.set(null);
        this.loadProjectLinks();
      },
      error: () => this.linksSaving.set(false),
    });
  }

  protected cancel(): void {
    void this.router.navigate(['/settings/projects']);
  }

  protected deleteProject(): void {
    const projectUuid = this.projectUuid();
    if (!projectUuid || this.deleting()) {
      return;
    }

    const confirmed = confirm(
      this.translate.instant('projects.edit.deleteConfirm'),
    );
    if (!confirmed) {
      return;
    }

    this.deleting.set(true);
    this.error.set(null);
    this.success.set(null);

    this.projectsService.delete(projectUuid).subscribe({
      next: () => {
        const remaining = this.activeProjectService
          .projects()
          .filter((item) => item.projectUuid !== projectUuid);
        this.activeProjectService.setProjects(remaining);
        void this.router.navigate(['/settings/projects']);
      },
      error: (err) => {
        this.error.set(apiErrorMessage(err));
        this.deleting.set(false);
      },
    });
  }
}

import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '@mds-ui/core';
import {
  GitProvider,
  LinkDialogSavePayload,
  ModelJoinView,
} from '@mds-ui/models';

import { WarehouseCreateDialogComponent } from '@mds-ui/feature-projects';
import { ProjectDetail } from '@mds-ui/feature-projects';
import { detectGitProvider } from '../git-provider.utils';
import {
  ConfirmDialogComponent,
  FilterableLinksTableComponent,
  LinkDialogComponent,
} from '@mds-ui/shared';
import { ProjectEditPageFacade } from '../../core/facades/project-edit-page.facade';

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
    FilterableLinksTableComponent,
    LinkDialogComponent,
  ],
  templateUrl: './project-edit-page.component.html',
  styleUrl: './project-edit-page.component.scss',
})
export class ProjectEditPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly facade = inject(ProjectEditPageFacade);
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);
  private readonly languageService = inject(LanguageService);

  protected readonly projectUuid = signal<string | null>(null);
  protected readonly loading = this.facade.loading;
  protected readonly saving = this.facade.saving;
  protected readonly deleting = this.facade.deleting;
  protected readonly syncing = this.facade.syncing;
  protected readonly desyncing = this.facade.desyncing;
  protected readonly error = this.facade.error;
  protected readonly success = this.facade.success;
  protected readonly project = this.facade.project;
  protected readonly repoStatus = this.facade.repoStatus;
  protected readonly warehouses = this.facade.warehouses;
  protected readonly activeSettingsTab =
    signal<ProjectSettingsTab>('configuration');
  protected readonly modelJoins = this.facade.modelJoins;
  protected readonly linksLoading = this.facade.linksLoading;
  protected readonly showLinkDialog = signal(false);
  protected readonly editingLink = signal<ModelJoinView | null>(null);
  protected readonly linksSaving = this.facade.linksSaving;

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

  protected readonly gitProviders: { value: GitProvider; labelKey: string }[] = [
    { value: 'github', labelKey: 'projects.git.providers.github' },
    { value: 'gitlab', labelKey: 'projects.git.providers.gitlab' },
    { value: 'bitbucket', labelKey: 'projects.git.providers.bitbucket' },
    { value: 'generic', labelKey: 'projects.git.providers.generic' },
  ];

  protected readonly modelLinkOptions = this.facade.modelLinkOptions;
  protected readonly linksCount = this.facade.linksCount;

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const projectUuid = params.get('projectUuid');
      if (!projectUuid) {
        return;
      }

      this.projectUuid.set(projectUuid);
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
    this.facade.load(projectUuid, (project) => this.applyProject(project));
  }

  private applyProject(project: ProjectDetail): void {
    this.name = project.name;
    this.selectedWarehouseUuid = project.warehouseUuid ?? null;
    this.gitRepoUrl = project.gitRepoUrl ?? '';
    this.gitDefaultBranch = project.gitDefaultBranch ?? 'main';
    this.gitProvider = project.gitProvider ?? detectGitProvider(project.gitRepoUrl ?? '');
    this.gitSubdirectory = project.gitSubdirectory ?? '';
    this.gitUsername = project.gitUsername ?? '';
    this.dbtProjectPath = project.dbtProjectPath ?? '';
    this.dbtTarget = project.dbtTarget ?? '';
    this.hasGitToken = project.hasGitToken ?? false;
    this.gitToken = '';
    this.clearGitToken = false;
    this.providerManuallySet = project.gitProvider != null;
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

      this.facade.addWarehouse(warehouse);
      this.selectedWarehouseUuid = warehouse.warehouseUuid;
    });
  }

  protected save(): void {
    const projectUuid = this.projectUuid();
    if (!projectUuid) {
      return;
    }

    this.facade.save(
      projectUuid,
      {
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
      },
      (project) => {
        this.applyProject(project);
      },
    );
  }

  protected syncRepository(): void {
    const projectUuid = this.projectUuid();
    if (!projectUuid || this.syncing()) {
      return;
    }

    this.facade.syncRepository(projectUuid);
  }

  protected desyncRepository(): void {
    const projectUuid = this.projectUuid();
    const repo = this.repoStatus();
    if (!projectUuid || !repo?.cloned || this.desyncing()) {
      return;
    }

    const confirmed = confirm(this.translate.instant('projects.git.removeConfirm'));
    if (!confirmed) {
      return;
    }

    this.facade.desyncRepository(projectUuid);
  }

  protected setSettingsTab(tab: ProjectSettingsTab): void {
    this.activeSettingsTab.set(tab);
    if (tab === 'links') {
      const projectUuid = this.projectUuid();
      if (projectUuid) {
        this.facade.loadLinks(projectUuid);
      }
    }
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
        this.facade.deleteLink(projectUuid, link);
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
    this.facade.saveLink(projectUuid, payload, () => {
        this.showLinkDialog.set(false);
        this.editingLink.set(null);
    });
  }

  protected cancel(): void {
    this.facade.cancel();
  }

  protected deleteProject(): void {
    const projectUuid = this.projectUuid();
    if (!projectUuid || this.deleting()) {
      return;
    }

    const confirmed = confirm(this.translate.instant('projects.edit.deleteConfirm'));
    if (!confirmed) {
      return;
    }

    this.facade.deleteProject(projectUuid);
  }
}

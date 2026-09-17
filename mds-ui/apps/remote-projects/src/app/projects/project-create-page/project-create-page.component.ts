import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';
import { GitProvider } from '@mds-ui/models';
import { WarehouseCreateDialogComponent } from '@mds-ui/feature-projects';
import { ProjectCreatePageFacade } from '../../core/facades/project-create-page.facade';
import { detectGitProvider } from '../git-provider.utils';

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
    TranslatePipe,
  ],
  templateUrl: './project-create-page.component.html',
  styleUrl: './project-create-page.component.scss',
})
export class ProjectCreatePageComponent {
  private readonly facade = inject(ProjectCreatePageFacade);
  private readonly dialog = inject(MatDialog);

  protected readonly loading = this.facade.loading;
  protected readonly submitting = this.facade.submitting;
  protected readonly error = this.facade.error;
  protected readonly warehouses = this.facade.warehouses;

  protected name = '';
  protected selectedWarehouseUuid: string | null = null;
  protected gitRepoUrl = '';
  protected gitDefaultBranch = 'main';
  protected gitProvider: GitProvider | null = null;
  protected gitSubdirectory = '';
  protected gitUsername = '';
  protected gitToken = '';
  protected dbtProjectPath = '';
  protected dbtTarget = '';
  private providerManuallySet = false;

  protected readonly gitProviders: { value: GitProvider; labelKey: string }[] = [
    { value: 'github', labelKey: 'projects.git.providers.github' },
    { value: 'gitlab', labelKey: 'projects.git.providers.gitlab' },
    { value: 'bitbucket', labelKey: 'projects.git.providers.bitbucket' },
    { value: 'generic', labelKey: 'projects.git.providers.generic' },
  ];

  constructor() {
    this.facade.loadWarehouses();
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

  protected cancel(): void {
    this.facade.cancel();
  }

  protected submit(): void {
    const trimmedName = this.name.trim();
    if (!trimmedName || this.submitting()) {
      return;
    }

    this.facade.save({
      name: trimmedName,
      warehouseUuid: this.selectedWarehouseUuid,
      gitRepoUrl: this.gitRepoUrl.trim() || null,
      gitDefaultBranch: this.gitDefaultBranch.trim() || 'main',
      gitProvider: this.gitProvider,
      gitSubdirectory: this.gitSubdirectory.trim() || null,
      gitUsername: this.gitUsername.trim() || null,
      gitToken: this.gitToken.trim() || null,
      dbtProjectPath: this.dbtProjectPath.trim() || null,
      dbtTarget: this.dbtTarget.trim() || null,
    });
  }
}

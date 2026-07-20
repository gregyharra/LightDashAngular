import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTabLink, MatTabNav, MatTabNavPanel } from '@angular/material/tabs';
import { ActiveProjectService } from '../../../core/services/active-project.service';
import { ResizableSidebarDirective } from '../../../layout/resizable-sidebar/resizable-sidebar.directive';

@Component({
  selector: 'app-project-edit-page',
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    MatIconModule,
    MatTabNav,
    MatTabLink,
    MatTabNavPanel,
    ResizableSidebarDirective,
  ],
  templateUrl: './project-edit-page.component.html',
  styleUrl: './project-edit-page.component.scss',
})
export class ProjectEditPageComponent {
  private readonly route = inject(ActivatedRoute);
  protected readonly activeProjectService = inject(ActiveProjectService);

  protected readonly projectUuid = signal<string | null>(null);

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const projectUuid = params.get('projectUuid');
      if (!projectUuid) {
        return;
      }

      this.projectUuid.set(projectUuid);
      this.activeProjectService.setActiveProject(projectUuid);
    });
  }
}

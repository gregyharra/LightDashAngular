import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { ActiveProjectService } from '../../core/services/active-project.service';

@Component({
  selector: 'app-navbar-project-switcher',
  imports: [MatButtonModule, MatIconModule, MatMenuModule],
  templateUrl: './navbar-project-switcher.component.html',
  styleUrl: './navbar-project-switcher.component.scss',
})
export class NavbarProjectSwitcherComponent {
  protected readonly activeProjectService = inject(ActiveProjectService);

  protected selectProject(projectUuid: string): void {
    this.activeProjectService.setActiveProject(projectUuid);
  }
}

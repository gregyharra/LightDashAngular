import { Component, HostListener, inject, OnInit, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { ActiveProjectService } from '../../core/services/active-project.service';
import { ProjectsService } from '../../features/projects/projects.service';
import { NavbarProjectSwitcherComponent } from '../navbar/navbar-project-switcher.component';
import { NavbarUserMenuComponent } from '../navbar/navbar-user-menu.component';

@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    NavbarUserMenuComponent,
    NavbarProjectSwitcherComponent,
  ],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
})
export class AppShellComponent implements OnInit {
  protected readonly activeProjectService = inject(ActiveProjectService);
  protected readonly searchExpanded = signal(false);
  private readonly projectsService = inject(ProjectsService);

  protected searchPlaceholder(projectName: string): string {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches) {
      return 'Search';
    }

    return `Search ${projectName}`;
  }

  protected toggleSearchExpanded(): void {
    this.searchExpanded.update((expanded) => !expanded);
  }

  protected closeSearchExpanded(): void {
    this.searchExpanded.set(false);
  }

  @HostListener('document:keydown.escape')
  protected onEscapeKey(): void {
    this.closeSearchExpanded();
  }

  ngOnInit(): void {
    this.projectsService.list().subscribe({
      next: (projects) => this.activeProjectService.setProjects(projects),
    });
  }
}

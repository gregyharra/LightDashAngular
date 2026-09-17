import { Component, computed, inject, OnInit } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { AppStateService } from '@mds-ui/core';
import { ActiveProjectService } from '@mds-ui/core';
import { ProjectsService } from '@mds-ui/feature-projects';
import { AiAssistantPanelComponent } from '@mds-ui/feature-ai';
import { AiAssistantUiService } from '@mds-ui/feature-ai';
import { NavbarProjectSwitcherComponent } from '../navbar/navbar-project-switcher.component';
import { NavbarSearchComponent } from '../navbar/navbar-search.component';
import { NavbarUserMenuComponent } from '../navbar/navbar-user-menu.component';
import {
  NAVBAR_SHOW_HELP,
  NAVBAR_SHOW_NOTIFICATIONS,
} from '../navbar/navbar-secondary-actions';

@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    MatIconModule,
    TranslatePipe,
    NavbarUserMenuComponent,
    NavbarProjectSwitcherComponent,
    NavbarSearchComponent,
    AiAssistantPanelComponent,
  ],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
})
export class AppShellComponent implements OnInit {
  protected readonly activeProjectService = inject(ActiveProjectService);
  private readonly projectsService = inject(ProjectsService);
  private readonly aiUi = inject(AiAssistantUiService);
  private readonly appState = inject(AppStateService);

  protected readonly askAiEnabled = computed(
    () => this.appState.health()?.askAiEnabled === true,
  );

  /** Stub navbar actions — see navbar-secondary-actions.ts */
  protected readonly showHelp = NAVBAR_SHOW_HELP;
  protected readonly showNotifications = NAVBAR_SHOW_NOTIFICATIONS;

  protected openAiAssistant(): void {
    if (!this.askAiEnabled()) {
      return;
    }
    this.aiUi.openPanel();
  }

  ngOnInit(): void {
    this.projectsService.list().subscribe({
      next: (projects) => this.activeProjectService.setProjects(projects),
    });
  }
}

import { Component, computed, inject, OnInit } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { TranslatePipe } from '@ngx-translate/core';
import { AppStateService } from '../../core/services/app-state.service';
import { ActiveProjectService } from '../../core/services/active-project.service';
import { ProjectsService } from '../../features/projects/projects.service';
import { AiAssistantPanelComponent } from '../../features/ai/ai-assistant-panel/ai-assistant-panel.component';
import { AiAssistantUiService } from '../../features/ai/ai-assistant-ui.service';
import { NavbarProjectSwitcherComponent } from '../navbar/navbar-project-switcher.component';
import { NavbarSearchComponent } from '../navbar/navbar-search.component';
import { NavbarUserMenuComponent } from '../navbar/navbar-user-menu.component';
import {
  NAVBAR_SHOW_HELP,
  NAVBAR_SHOW_NOTIFICATIONS,
  NAVBAR_SHOW_SETTINGS,
} from '../navbar/navbar-secondary-actions';
import { exploreRootPath } from '../../features/explorer/explore-routes';

@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
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
  protected readonly showSettings = NAVBAR_SHOW_SETTINGS;
  protected readonly showRightOverflowMenu =
    NAVBAR_SHOW_HELP || NAVBAR_SHOW_NOTIFICATIONS || NAVBAR_SHOW_SETTINGS;

  protected readonly exploreRootPath = exploreRootPath;

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

import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { provideFeatureTranslations } from '@mds-ui/core';
import { ResizableSidebarDirective } from '@mds-ui/shared';
import { SettingsSidebarNavComponent } from '../settings-sidebar-nav/settings-sidebar-nav.component';

@Component({
  selector: 'mds-settings-shell',
  imports: [RouterOutlet, ResizableSidebarDirective, SettingsSidebarNavComponent],
  // Loaded via loadComponent from the shell routes (no lib route object), so the
  // projects catalog (settings.* keys) is provided on the component itself.
  providers: [...provideFeatureTranslations('projects')],
  templateUrl: './settings-shell.component.html',
  styleUrl: './settings-shell.component.scss',
})
export class SettingsShellComponent {}

import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ResizableSidebarDirective } from '@mds-ui/shared';
import { SettingsSidebarNavComponent } from '../settings-sidebar-nav/settings-sidebar-nav.component';

@Component({
  selector: 'app-settings-shell',
  imports: [RouterOutlet, ResizableSidebarDirective, SettingsSidebarNavComponent],
  templateUrl: './settings-shell.component.html',
  styleUrl: './settings-shell.component.scss',
})
export class SettingsShellComponent {}

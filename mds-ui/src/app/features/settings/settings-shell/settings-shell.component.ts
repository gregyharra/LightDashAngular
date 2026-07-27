import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ResizableSidebarDirective } from '../../../layout/resizable-sidebar/resizable-sidebar.directive';
import { SettingsSidebarNavComponent } from '../../../layout/settings-sidebar-nav/settings-sidebar-nav.component';

@Component({
  selector: 'app-settings-shell',
  imports: [RouterOutlet, ResizableSidebarDirective, SettingsSidebarNavComponent],
  templateUrl: './settings-shell.component.html',
  styleUrl: './settings-shell.component.scss',
})
export class SettingsShellComponent {}

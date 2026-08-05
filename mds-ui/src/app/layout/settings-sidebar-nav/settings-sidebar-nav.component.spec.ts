import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AppStateService } from '../../core/services/app-state.service';
import { AuthService } from '../../core/services/auth.service';
import { SettingsSidebarNavComponent } from './settings-sidebar-nav.component';

@Component({
  selector: 'app-settings-nav-host',
  imports: [SettingsSidebarNavComponent],
  template: `
    <div class="page-sidebar" [class.page-sidebar--collapsed]="collapsed">
      <app-settings-sidebar-nav />
    </div>
  `,
})
class SettingsNavHostComponent {
  collapsed = false;
}

describe('SettingsSidebarNavComponent', () => {
  let fixture: ComponentFixture<SettingsNavHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SettingsNavHostComponent],
      providers: [
        provideRouter([]),
        {
          provide: AppStateService,
          useValue: {
            user: () => ({ email: 'demo@lightdash.com' }),
            isAdmin: () => true,
          },
        },
        {
          provide: AuthService,
          useValue: { logout: () => of(null) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsNavHostComponent);
  });

  it('hides email and Settings label when the sidebar is collapsed', () => {
    fixture.componentInstance.collapsed = true;
    fixture.detectChanges();

    const header = fixture.nativeElement.querySelector(
      '.settings-nav__header',
    ) as HTMLElement;
    const styles = getComputedStyle(header);

    expect(styles.opacity).toBe('0');
    expect(styles.overflow).toBe('hidden');
    expect(header.getBoundingClientRect().height).toBe(0);
  });
});

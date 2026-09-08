import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { AppStateService } from '../../../core/services/app-state.service';
import { AuthService, ManagedUser } from '../../../core/services/auth.service';
import { UsersPageComponent } from './users-page.component';

describe('UsersPageComponent', () => {
  let fixture: ComponentFixture<UsersPageComponent>;
  const ssoEnabled = signal(false);
  const users: ManagedUser[] = [
    {
      userUuid: 'user-1',
      email: 'admin@example.com',
      firstName: 'Ada',
      lastName: 'Admin',
      role: 'admin',
      isActive: true,
      createdAt: null,
    },
  ];

  beforeEach(async () => {
    ssoEnabled.set(false);

    await TestBed.configureTestingModule({
      imports: [UsersPageComponent, NoopAnimationsModule],
      providers: [
        provideTranslateService({ fallbackLang: 'en', lang: 'en' }),
        {
          provide: AppStateService,
          useValue: { ssoEnabled: ssoEnabled.asReadonly() },
        },
        {
          provide: AuthService,
          useValue: { listUsers: () => of(users) },
        },
      ],
    }).compileComponents();

    TestBed.inject(TranslateService).setTranslation('en', {
      users: {
        title: 'Users',
        subtitle: 'Create and manage workspace users.',
        ssoManaged: 'Access and roles are managed by your identity provider.',
        fields: {
          name: 'Name',
          email: 'Email',
          role: 'Role',
          status: 'Status',
        },
        status: { active: 'Active', inactive: 'Inactive' },
        create: { button: 'Create user' },
        edit: { button: 'Edit' },
        password: { resetButton: 'Reset password' },
        deactivate: 'Deactivate',
      },
    });
  });

  function render(): HTMLElement {
    fixture = TestBed.createComponent(UsersPageComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders the local user-management actions when SSO is disabled', () => {
    const page = render();

    expect(page.textContent).toContain('Create user');
    expect(page.textContent).toContain('Edit');
    expect(page.textContent).toContain('Reset password');
    expect(page.textContent).toContain('Deactivate');
  });

  it('renders a read-only directory with the role column when SSO is enabled', () => {
    ssoEnabled.set(true);
    const page = render();

    expect(page.textContent).toContain('Access and roles are managed by your identity provider.');
    expect(page.textContent).toContain('Role');
    expect(page.textContent).toContain('admin');
    expect(page.textContent).not.toContain('Create user');
    expect(page.textContent).not.toContain('Edit');
    expect(page.textContent).not.toContain('Reset password');
    expect(page.textContent).not.toContain('Deactivate');
    expect(page.querySelector('.users__actions-cell')).toBeNull();
  });
});

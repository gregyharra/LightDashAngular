import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { UsersPageComponent } from './users-page.component';

describe('UsersPageComponent', () => {
  let fixture: ComponentFixture<UsersPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UsersPageComponent, NoopAnimationsModule],
      providers: [
        provideTranslateService({ fallbackLang: 'en', lang: 'en' }),
        {
          provide: AuthService,
          useValue: { listUsers: () => of([]) },
        },
      ],
    }).compileComponents();

    TestBed.inject(TranslateService).setTranslation('en', {
      users: {
        title: 'Users',
        subtitle: 'Manage user access.',
        empty: 'No users.',
        create: { button: 'Create user' },
      },
    });

    fixture = TestBed.createComponent(UsersPageComponent);
    fixture.detectChanges();
  });

  it('renders the design-system page header and create action when loaded', () => {
    const header = fixture.debugElement.query(By.css('ld-page-header'));

    expect(header).toBeTruthy();
    expect((header?.nativeElement as HTMLElement | undefined)?.textContent).toContain('Users');
    expect(
      fixture.debugElement.query(By.css('ld-page-header ld-button[ldActions]')),
    ).toBeTruthy();
  });

  it('adds page spacing below the design-system header', () => {
    const header = fixture.debugElement.query(By.css('ld-page-header'));

    expect(getComputedStyle(header.nativeElement).marginBottom).toBe('24px');
  });
});

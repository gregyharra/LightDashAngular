import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';
import { AppStateService } from '../../../core/services/app-state.service';
import { ResetPasswordPageComponent } from './reset-password-page.component';

describe('ResetPasswordPageComponent', () => {
  let fixture: ComponentFixture<ResetPasswordPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResetPasswordPageComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        provideTranslateService(),
        { provide: AuthService, useValue: {} },
        { provide: AppStateService, useValue: { user: () => ({ mustChangePassword: true }) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ResetPasswordPageComponent);
    fixture.detectChanges();
  });

  it('renders the primary submit action with the design-system button', () => {
    const action = fixture.debugElement.query(By.css('ld-button[type="submit"]'));

    expect(action).toBeTruthy();
    expect(action.query(By.css('button[type="submit"]'))).toBeTruthy();
  });
});

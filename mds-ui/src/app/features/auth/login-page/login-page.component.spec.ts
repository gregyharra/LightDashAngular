import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';
import { LoginPageComponent } from './login-page.component';

describe('LoginPageComponent', () => {
  let fixture: ComponentFixture<LoginPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginPageComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        provideTranslateService(),
        { provide: AuthService, useValue: {} },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginPageComponent);
    fixture.detectChanges();
  });

  it('renders the primary submit action with the design-system button', () => {
    const action = fixture.debugElement.query(By.css('ld-button[type="submit"]'));

    expect(action).toBeTruthy();
    expect(action.query(By.css('button[type="submit"]'))).toBeTruthy();
  });
});

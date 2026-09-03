import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';
import { SetupPageComponent } from './setup-page.component';

describe('SetupPageComponent', () => {
  let fixture: ComponentFixture<SetupPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SetupPageComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        provideTranslateService(),
        { provide: AuthService, useValue: {} },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SetupPageComponent);
    fixture.detectChanges();
  });

  it('renders the primary submit action with the shared UI button', () => {
    const action = fixture.debugElement.query(By.css('dpf-button[type="submit"]'));

    expect(action).toBeTruthy();
    expect(action.query(By.css('button[type="submit"]'))).toBeTruthy();
  });
});

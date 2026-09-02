import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { LdButtonComponent } from './ld-button.component';

describe('LdButtonComponent', () => {
  let fixture: ComponentFixture<LdButtonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LdButtonComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(LdButtonComponent);
    fixture.detectChanges();
  });

  it('applies variant and tone host classes', () => {
    fixture.componentRef.setInput('variant', 'outlined');
    fixture.componentRef.setInput('tone', 'neutral');
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.classList.contains('ld-button--outlined')).toBeTrue();
    expect(host.classList.contains('ld-button--neutral')).toBeTrue();
  });

  it('disables the inner button when disabled or loading', () => {
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();
    const btn = fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement;
    expect(btn.disabled).toBeTrue();
  });
});

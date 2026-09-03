import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DpfIconButtonComponent } from './icon-button.component';

describe('DpfIconButtonComponent', () => {
  let fixture: ComponentFixture<DpfIconButtonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DpfIconButtonComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(DpfIconButtonComponent);
    fixture.componentRef.setInput('icon', 'auto_awesome');
    fixture.componentRef.setInput('ariaLabel', 'Ask AI');
  });

  it('sets the button aria-label and base host class', () => {
    fixture.detectChanges();
    const button = fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement;
    const icon = fixture.debugElement.query(By.css('mat-icon')).nativeElement as HTMLElement;
    const buttonStyles = getComputedStyle(button);
    expect(button.getAttribute('aria-label')).toBe('Ask AI');
    expect((fixture.nativeElement as HTMLElement).classList.contains('dpf-icon-button')).toBeTrue();
    expect(buttonStyles.width).toBe('40px');
    expect(buttonStyles.height).toBe('40px');
    expect(buttonStyles.borderTopWidth).toBe('1px');
    expect(buttonStyles.borderRadius).toBe('50%');
    expect(buttonStyles.color).toBe('rgb(134, 142, 150)');
    expect(getComputedStyle(icon).fontSize).toBe('18px');
  });

  it('adds the AI tone host class', () => {
    fixture.componentRef.setInput('tone', 'ai');
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const button = fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement;

    expect(host.classList.contains('dpf-icon-button--ai')).toBeTrue();
    expect(getComputedStyle(button).color).toBe('rgb(124, 92, 191)');
  });
});

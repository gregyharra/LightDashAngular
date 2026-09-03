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

  it('binds aria-pressed to the inner button when provided', () => {
    let btn = fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement;
    expect(btn.hasAttribute('aria-pressed')).toBeFalse();

    fixture.componentRef.setInput('ariaPressed', true);
    fixture.detectChanges();

    btn = fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement;
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  it('uses the semantic on-brand color for filled primary buttons', () => {
    fixture.detectChanges();
    const btn = fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement;

    expect(getComputedStyle(btn).color).toBe('rgb(255, 255, 255)');
  });

  it('vertically centers leading icons with the label', () => {
    fixture.componentRef.setInput('icon', 'add');
    fixture.detectChanges();

    const btn = fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement;
    const icon = fixture.debugElement.query(By.css('mat-icon')).nativeElement as HTMLElement;
    const btnStyle = getComputedStyle(btn);
    const iconStyle = getComputedStyle(icon);

    expect(btnStyle.alignItems).toBe('center');
    expect(['flex', 'inline-flex']).toContain(iconStyle.display);
    expect(iconStyle.alignItems).toBe('center');
    expect(iconStyle.width).toBe('18px');
    expect(iconStyle.height).toBe('18px');
    expect(iconStyle.fontSize).toBe('18px');
    expect(iconStyle.lineHeight).toBe('18px');
  });
});

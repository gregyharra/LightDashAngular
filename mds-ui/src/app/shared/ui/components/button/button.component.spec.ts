import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DpfButtonComponent } from './button.component';

@Component({
  standalone: true,
  imports: [DpfButtonComponent],
  template: `<dpf-button icon="add">Create dashboard</dpf-button>`,
})
class DpfButtonHostComponent {}

describe('DpfButtonComponent', () => {
  let fixture: ComponentFixture<DpfButtonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DpfButtonComponent, DpfButtonHostComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(DpfButtonComponent);
    fixture.detectChanges();
  });

  it('applies variant and tone host classes', () => {
    fixture.componentRef.setInput('variant', 'outlined');
    fixture.componentRef.setInput('tone', 'neutral');
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.classList.contains('dpf-button--outlined')).toBeTrue();
    expect(host.classList.contains('dpf-button--neutral')).toBeTrue();
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

  it('resets padding and centers the content cluster', () => {
    const hostFixture = TestBed.createComponent(DpfButtonHostComponent);
    hostFixture.detectChanges();

    const btn = hostFixture.debugElement.query(By.css('dpf-button button'))
      .nativeElement as HTMLButtonElement;
    const icon = hostFixture.debugElement.query(By.css('.dpf-button__icon'))
      .nativeElement as HTMLElement;
    const label = hostFixture.debugElement.query(By.css('.dpf-button__label'))
      .nativeElement as HTMLElement;
    const content = hostFixture.debugElement.query(By.css('.dpf-button__content'))
      .nativeElement as HTMLElement;

    const btnStyle = getComputedStyle(btn);
    const contentStyle = getComputedStyle(content);
    const iconStyle = getComputedStyle(icon);

    expect(['flex', 'inline-flex']).toContain(btnStyle.display);
    expect(btnStyle.alignItems).toBe('center');
    expect(btnStyle.justifyContent).toBe('center');
    expect(btnStyle.paddingTop).toBe('0px');
    expect(btnStyle.paddingBottom).toBe('0px');
    expect(btnStyle.paddingLeft).toBe(btnStyle.paddingRight);
    expect(btnStyle.height).toBe('36px');

    expect(['flex', 'inline-flex']).toContain(contentStyle.display);
    expect(contentStyle.alignItems).toBe('center');
    expect(iconStyle.width).toBe('18px');
    expect(iconStyle.height).toBe('18px');
    expect(iconStyle.marginTop).toBe('0px');
    expect(iconStyle.marginBottom).toBe('0px');

    const br = btn.getBoundingClientRect();
    const ir = icon.getBoundingClientRect();
    const lr = label.getBoundingClientRect();
    const iconSlackTop = ir.top - br.top;
    const iconSlackBottom = br.bottom - ir.bottom;
    const labelSlackTop = lr.top - br.top;
    const labelSlackBottom = br.bottom - lr.bottom;

    expect(Math.abs(iconSlackTop - iconSlackBottom))
      .withContext('icon vertically centered in button')
      .toBeLessThanOrEqual(1);
    expect(Math.abs(labelSlackTop - labelSlackBottom))
      .withContext('label vertically centered in button')
      .toBeLessThanOrEqual(1);
    expect(Math.abs(ir.top - lr.top))
      .withContext('icon and label share the same top edge within 2px')
      .toBeLessThanOrEqual(2);
  });
});

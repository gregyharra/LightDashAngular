import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { LdIconButtonComponent } from './ld-icon-button.component';

describe('LdIconButtonComponent', () => {
  let fixture: ComponentFixture<LdIconButtonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LdIconButtonComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(LdIconButtonComponent);
    fixture.componentRef.setInput('icon', 'auto_awesome');
    fixture.componentRef.setInput('ariaLabel', 'Ask AI');
  });

  it('sets the button aria-label and base host class', () => {
    fixture.detectChanges();
    const button = fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement;
    expect(button.getAttribute('aria-label')).toBe('Ask AI');
    expect((fixture.nativeElement as HTMLElement).classList.contains('ld-icon-button')).toBeTrue();
  });

  it('adds the AI tone host class', () => {
    fixture.componentRef.setInput('tone', 'ai');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).classList.contains('ld-icon-button--ai')).toBeTrue();
  });
});

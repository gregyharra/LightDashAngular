import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { LdSearchFieldComponent } from './ld-search-field.component';

describe('LdSearchFieldComponent', () => {
  let fixture: ComponentFixture<LdSearchFieldComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LdSearchFieldComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(LdSearchFieldComponent);
    fixture.componentRef.setInput('ariaLabel', 'Search project');
  });

  it('emits valueChange when typing and sets the aria-label', () => {
    const emitted: string[] = [];
    fixture.componentInstance.valueChange.subscribe((value: string) => emitted.push(value));
    fixture.detectChanges();
    const input = fixture.debugElement.query(By.css('input')).nativeElement as HTMLInputElement;
    input.value = 'orders';
    input.dispatchEvent(new Event('input'));
    expect(emitted).toEqual(['orders']);
    expect(input.getAttribute('aria-label')).toBe('Search project');
  });

  it('shows a spinner while loading', () => {
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('mat-spinner'))).not.toBeNull();
  });
});

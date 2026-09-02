import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { LdEmptyStateComponent } from './ld-empty-state.component';

@Component({
  imports: [LdEmptyStateComponent],
  template: `
    <ld-empty-state data-testid="without-cta" title="No results" />
    <ld-empty-state
      data-testid="with-cta"
      title="No dashboards"
      body="Create a dashboard to get started."
      icon="dashboard"
    >
      <button ldCta type="button">Create dashboard</button>
    </ld-empty-state>
  `,
})
class TestHostComponent {}

describe('LdEmptyStateComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
  });

  it('always renders its title', () => {
    const emptyState = fixture.debugElement.query(By.css('[data-testid="without-cta"]'));

    expect(emptyState.query(By.css('.ld-empty-state__title')).nativeElement.textContent.trim())
      .toBe('No results');
  });

  it('does not render a CTA when none is projected', () => {
    const emptyState = fixture.debugElement.query(By.css('[data-testid="without-cta"]'));

    expect(emptyState.query(By.css('[ldCta]'))).toBeNull();
  });

  it('renders optional content and a projected ldCta', () => {
    const emptyState = fixture.debugElement.query(By.css('[data-testid="with-cta"]'));

    expect(emptyState.query(By.css('.ld-empty-state__body')).nativeElement.textContent.trim())
      .toBe('Create a dashboard to get started.');
    expect(emptyState.query(By.css('mat-icon')).nativeElement.textContent.trim()).toBe('dashboard');
    expect(emptyState.query(By.css('[ldCta]')).nativeElement.textContent.trim())
      .toBe('Create dashboard');
  });
});

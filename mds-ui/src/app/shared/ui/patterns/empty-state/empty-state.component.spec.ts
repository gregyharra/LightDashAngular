import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DpfEmptyStateComponent } from './empty-state.component';

@Component({
  imports: [DpfEmptyStateComponent],
  template: `
    <dpf-empty-state data-testid="without-cta" title="No results" />
    <dpf-empty-state
      data-testid="with-cta"
      title="No dashboards"
      body="Create a dashboard to get started."
      icon="dashboard"
    >
      <button dpfCta type="button">Create dashboard</button>
    </dpf-empty-state>
  `,
})
class TestHostComponent {}

describe('DpfEmptyStateComponent', () => {
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

    expect(emptyState.query(By.css('.dpf-empty-state__title')).nativeElement.textContent.trim())
      .toBe('No results');
  });

  it('does not render a CTA when none is projected', () => {
    const emptyState = fixture.debugElement.query(By.css('[data-testid="without-cta"]'));

    expect(emptyState.query(By.css('[dpfCta]'))).toBeNull();
  });

  it('renders optional content and a projected dpfCta', () => {
    const emptyState = fixture.debugElement.query(By.css('[data-testid="with-cta"]'));

    expect(emptyState.query(By.css('.dpf-empty-state__body')).nativeElement.textContent.trim())
      .toBe('Create a dashboard to get started.');
    expect(emptyState.query(By.css('mat-icon')).nativeElement.textContent.trim()).toBe('dashboard');
    expect(emptyState.query(By.css('[dpfCta]')).nativeElement.textContent.trim())
      .toBe('Create dashboard');
  });
});

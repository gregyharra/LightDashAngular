import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatTooltip } from '@angular/material/tooltip';
import { provideRouter } from '@angular/router';
import { TablesFieldsPanelComponent } from './tables-fields-panel.component';

describe('TablesFieldsPanelComponent', () => {
  let fixture: ComponentFixture<TablesFieldsPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TablesFieldsPanelComponent, NoopAnimationsModule],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(TablesFieldsPanelComponent);
    fixture.componentRef.setInput('projectUuid', 'test-project');
    fixture.componentRef.setInput('tableId', 'orders');
    fixture.componentRef.setInput('tableLabel', 'Orders');
    fixture.componentRef.setInput('hasExplore', true);
  });

  it('renders join issues as disabled groups with a suggested target tooltip', () => {
    fixture.componentRef.setInput('fieldGroups', [
      {
        table: { name: 'custmers', label: 'Customers' },
        dimensions: [
          {
            fieldId: 'custmers_id',
            label: 'Customer ID',
            type: 'string',
          },
        ],
        metrics: [{ fieldId: 'custmers_count', label: 'Count' }],
        issue: {
          table: 'custmers',
          label: 'Customers',
          code: 'JOIN_TARGET_NOT_FOUND',
          message: 'Join target "custmers" was not found.',
          severity: 'error',
          suggestion: 'customers',
        },
      },
    ]);

    fixture.detectChanges();

    const issueSection = fixture.debugElement.query(
      By.css('.tables-fields-panel__section--issue'),
    );
    expect(issueSection).withContext('issue section').not.toBeNull();
    expect(issueSection.nativeElement.textContent).toContain('Customers');
    expect(
      issueSection.queryAll(By.css('.tables-fields-panel__item')).length,
    ).toBe(0);

    const tooltip = issueSection
      .query(By.directive(MatTooltip))
      .injector.get(MatTooltip);
    expect(tooltip.message).toContain(
      'Join target "custmers" was not found. Did you mean customers?',
    );
  });
});

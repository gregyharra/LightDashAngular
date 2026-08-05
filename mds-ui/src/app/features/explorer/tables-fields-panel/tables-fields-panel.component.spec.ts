import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatTooltip } from '@angular/material/tooltip';
import { provideRouter } from '@angular/router';
import {
  filterTablesFieldGroups,
  TablesFieldGroup,
  TablesFieldsPanelComponent,
} from './tables-fields-panel.component';

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
        trackKey: 'issue:custmers:JOIN_TARGET_NOT_FOUND:0',
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

    const tooltipTrigger = issueSection.query(By.directive(MatTooltip));
    expect(tooltipTrigger.nativeElement.tagName).toBe('BUTTON');
    expect(tooltipTrigger.nativeElement.tabIndex).toBe(0);

    const tooltip = tooltipTrigger.injector.get(MatTooltip);
    expect(tooltip.message).toContain(
      'Join target "custmers" was not found. Did you mean customers?',
    );
  });

  it('renders groups with duplicate table names when their tracking keys differ', () => {
    fixture.componentRef.setInput('fieldGroups', [
      {
        trackKey: 'table:customers',
        table: { name: 'customers', label: 'Customers' },
        dimensions: [],
        metrics: [],
      },
      {
        trackKey: 'issue:customers:JOIN_TARGET_NOT_FOUND:0',
        table: { name: 'customers', label: 'Broken customers join' },
        dimensions: [],
        metrics: [],
        issue: {
          table: 'customers',
          label: 'Broken customers join',
          code: 'JOIN_TARGET_NOT_FOUND',
          message: 'Join target "customers" was not found.',
          severity: 'error',
        },
      },
    ]);

    fixture.detectChanges();

    const sections = fixture.debugElement.queryAll(
      By.css('.tables-fields-panel__section'),
    );
    expect(sections.length).toBe(2);
    expect(sections[0].nativeElement.textContent).toContain('Customers');
    expect(sections[1].nativeElement.textContent).toContain(
      'Broken customers join',
    );
  });

  it('preserves issue groups while filtering fields', () => {
    const groups: TablesFieldGroup[] = [
      {
        trackKey: 'table:orders',
        table: { name: 'orders', label: 'Orders' },
        dimensions: [
          { fieldId: 'orders_id', label: 'Order ID', type: 'string' },
        ],
        metrics: [{ fieldId: 'orders_count', label: 'Order count' }],
      },
      {
        trackKey: 'issue:custmers:JOIN_TARGET_NOT_FOUND:0',
        table: { name: 'custmers', label: 'Customers' },
        dimensions: [],
        metrics: [],
        issue: {
          table: 'custmers',
          label: 'Customers',
          code: 'JOIN_TARGET_NOT_FOUND',
          message: 'Join target "custmers" was not found.',
          severity: 'error',
        },
      },
    ];

    expect(filterTablesFieldGroups(groups, 'does not match')).toEqual([
      groups[1],
    ]);
  });
});

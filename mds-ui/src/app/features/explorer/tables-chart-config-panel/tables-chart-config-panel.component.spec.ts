import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { DEFAULT_CHART_DISPLAY_CONFIG } from './tables-chart-config.constants';
import {
  TablesChartConfigPanelComponent,
  updateSeriesType,
} from './tables-chart-config-panel.component';

describe('updateSeriesType', () => {
  it('updates the type for one field while preserving others', () => {
    const series = [
      { fieldId: 'orders_revenue', type: 'bar' as const },
      { fieldId: 'orders_count', type: 'bar' as const },
    ];

    expect(updateSeriesType(series, 'orders_count', 'line')).toEqual([
      { fieldId: 'orders_revenue', type: 'bar' },
      { fieldId: 'orders_count', type: 'line' },
    ]);
  });
});

describe('TablesChartConfigPanelComponent', () => {
  let fixture: ComponentFixture<TablesChartConfigPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TablesChartConfigPanelComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(TablesChartConfigPanelComponent);
    fixture.componentRef.setInput('chartKind', 'pie');
    fixture.componentRef.setInput('chartXField', 'orders_status');
    fixture.componentRef.setInput('chartYFields', ['orders_revenue']);
    fixture.componentRef.setInput('selectedDimensions', ['orders_status']);
    fixture.componentRef.setInput('selectedMetrics', ['orders_revenue']);
    fixture.componentRef.setInput('displayConfig', DEFAULT_CHART_DISPLAY_CONFIG);
    fixture.componentRef.setInput('hasQueryResults', true);
    fixture.componentRef.setInput('getFieldLabel', (fieldId: string) => fieldId);
  });

  it('shows pie layout and display controls instead of the unsupported placeholder', () => {
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).not.toContain(
      'Switch to a bar, line, or table chart for additional configuration options.',
    );
    expect(text).toContain('Group');
    expect(text).toContain('Metric');
    expect(text).toContain('Display');
    expect(text).toContain('Margins');
  });

  it('emits field changes for pie group and metric', () => {
    fixture.detectChanges();

    const xEmissions: string[] = [];
    const yEmissions: string[][] = [];
    fixture.componentInstance.chartXFieldChange.subscribe((value) =>
      xEmissions.push(value),
    );
    fixture.componentInstance.chartYFieldsChange.subscribe((value) =>
      yEmissions.push(value),
    );

    const api = fixture.componentInstance as unknown as {
      setChartXField: (fieldId: string) => void;
      setPieMetric: (fieldId: string) => void;
    };
    api.setChartXField('orders_region');
    api.setPieMetric('orders_count');

    expect(xEmissions).toEqual(['orders_region']);
    expect(yEmissions).toEqual([['orders_count']]);
  });

  it('emits seriesChange when mixed chart series type changes', () => {
    fixture.componentRef.setInput('chartKind', 'mixed');
    fixture.componentRef.setInput('chartYFields', ['orders_revenue', 'orders_count']);
    fixture.componentRef.setInput('series', [
      { fieldId: 'orders_revenue', type: 'bar' },
      { fieldId: 'orders_count', type: 'bar' },
    ]);
    fixture.detectChanges();

    const emissions: Array<Array<{ fieldId: string; type: string }>> = [];
    fixture.componentInstance.seriesChange.subscribe((value) => emissions.push(value));

    const api = fixture.componentInstance as unknown as {
      setSeriesType: (fieldId: string, type: 'bar' | 'line' | 'area') => void;
    };
    api.setSeriesType('orders_count', 'line');

    expect(emissions).toEqual([
      [
        { fieldId: 'orders_revenue', type: 'bar' },
        { fieldId: 'orders_count', type: 'line' },
      ],
    ]);
  });
});

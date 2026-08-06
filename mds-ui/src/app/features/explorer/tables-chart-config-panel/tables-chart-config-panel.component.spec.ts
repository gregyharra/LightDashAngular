import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { DEFAULT_CHART_DISPLAY_CONFIG } from './tables-chart-config.constants';
import { TablesChartConfigPanelComponent } from './tables-chart-config-panel.component';

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


  it('shows funnel layout and display controls', () => {
    fixture.componentRef.setInput('chartKind', 'funnel');
    fixture.componentRef.setInput('chartXField', 'orders_revenue');
    fixture.componentRef.setInput('chartYFields', ['orders_status']);
    fixture.componentRef.setInput('funnelDataInput', 'column');
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Metric');
    expect(text).toContain('Label (optional)');
    expect(text).toContain('Orientation');
    expect(text).toContain('Display');
    expect(text).not.toContain('Funnel field configuration is available in a future update.');
  });

  it('emits funnel field and dataInput changes', () => {
    fixture.componentRef.setInput('chartKind', 'funnel');
    fixture.componentRef.setInput('chartXField', 'orders_revenue');
    fixture.componentRef.setInput('chartYFields', ['orders_status']);
    fixture.componentRef.setInput('funnelDataInput', 'column');
    fixture.detectChanges();

    const xEmissions: string[] = [];
    const yEmissions: string[][] = [];
    const dataInputEmissions: Array<'column' | 'row'> = [];
    fixture.componentInstance.chartXFieldChange.subscribe((value) =>
      xEmissions.push(value),
    );
    fixture.componentInstance.chartYFieldsChange.subscribe((value) =>
      yEmissions.push(value),
    );
    fixture.componentInstance.funnelDataInputChange.subscribe((value) =>
      dataInputEmissions.push(value),
    );

    const api = fixture.componentInstance as unknown as {
      setFunnelMetric: (fieldId: string) => void;
      setFunnelLabelField: (fieldId: string | null) => void;
      setFunnelDataInput: (dataInput: 'column' | 'row') => void;
    };
    api.setFunnelMetric('orders_count');
    api.setFunnelLabelField('orders_region');
    api.setFunnelDataInput('row');

    expect(xEmissions).toEqual(['orders_count']);
    expect(yEmissions).toEqual([['orders_region']]);
    expect(dataInputEmissions).toEqual(['row']);
  });
});

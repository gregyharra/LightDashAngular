import { mockSavedChartsList } from './charts.fixture';

describe('charts.fixture', () => {
  it('includes the seven expanded chart kinds', () => {
    expect(mockSavedChartsList.map((chart) => chart.chartKind)).toEqual(
      jasmine.arrayContaining([
        'area',
        'scatter',
        'mixed',
        'funnel',
        'treemap',
        'gauge',
        'sankey',
      ]),
    );
  });
});

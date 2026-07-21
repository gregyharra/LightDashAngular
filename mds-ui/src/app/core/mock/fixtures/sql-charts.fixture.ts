export type MockSqlChartBasic = {
  uuid: string;
  name: string;
};

export const MOCK_SQL_CHART_1_UUID = 'c3c3c3c3-d3d3-4e3e-f4f4-f4f4f4f4f4f4';
export const MOCK_SQL_CHART_2_UUID = 'd4d4d4d4-e4e4-4f4f-a5a5-a5a5a5a5a5a5';

export const mockSqlCharts: MockSqlChartBasic[] = [
  {
    uuid: MOCK_SQL_CHART_1_UUID,
    name: 'Orders by status (SQL)',
  },
  {
    uuid: MOCK_SQL_CHART_2_UUID,
    name: 'Monthly revenue trend (SQL)',
  },
];

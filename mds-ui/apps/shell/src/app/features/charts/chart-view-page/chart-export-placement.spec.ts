import { chartExportPlacement } from './chart-export-placement';

describe('chartExportPlacement', () => {
  it('places export in the header when not editing', () => {
    expect(chartExportPlacement(false)).toBe('header');
  });

  it('places export in the results panel when editing', () => {
    expect(chartExportPlacement(true)).toBe('results');
  });
});

import { resolveChartDraftName } from './chart-draft-name';

describe('resolveChartDraftName', () => {
  it('uses the current translated default while the name is untouched', () => {
    expect(resolveChartDraftName('', false, 'Untitled chart')).toBe('Untitled chart');
    expect(resolveChartDraftName('', false, 'Graphique sans titre')).toBe(
      'Graphique sans titre',
    );
  });

  it('preserves a user-edited name when the language changes', () => {
    expect(resolveChartDraftName('Revenue', true, 'Graphique sans titre')).toBe(
      'Revenue',
    );
  });
});

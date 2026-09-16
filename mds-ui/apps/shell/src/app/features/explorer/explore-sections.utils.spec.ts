import { ExploreSummary } from '../../core/models/explore.model';
import {
  formatTagLabel,
  groupExploresByTags,
} from './explore-sections.utils';

function explore(
  partial: Pick<ExploreSummary, 'name' | 'label'> &
    Partial<ExploreSummary>,
): ExploreSummary {
  return {
    tags: [],
    schemaName: 'marts',
    databaseName: 'db',
    ...partial,
  };
}

describe('formatTagLabel', () => {
  it('title-cases and replaces underscores', () => {
    expect(formatTagLabel('ecommerce')).toBe('Ecommerce');
    expect(formatTagLabel('business_group')).toBe('Business group');
  });
});

describe('groupExploresByTags', () => {
  it('groups by tags[0] section and tags[1] subcategory with fallbacks', () => {
    const sections = groupExploresByTags([
      explore({
        name: 'z',
        label: 'Zebra',
        tags: ['ecommerce', 'fact'],
      }),
      explore({
        name: 'a',
        label: 'Alpha',
        tags: ['ecommerce', 'dimension'],
      }),
      explore({
        name: 'b',
        label: 'Beta',
        tags: ['ecommerce', 'dimension'],
      }),
      explore({ name: 'orphan', label: 'Orphan', tags: [] }),
      explore({
        name: 'one-tag',
        label: 'One Tag',
        tags: ['support'],
      }),
      explore({
        name: 'underscored',
        label: 'Underscored',
        tags: ['risk_ops', 'facility_events'],
      }),
    ]);

    expect(sections.map((s) => s.key)).toEqual([
      'ecommerce',
      'general',
      'risk_ops',
      'support',
    ]);
    expect(sections.map((s) => s.label)).toEqual([
      'Ecommerce',
      'General',
      'Risk ops',
      'Support',
    ]);

    const ecommerce = sections[0];
    expect(ecommerce.count).toBe(3);
    expect(ecommerce.subcategories.map((s) => s.key)).toEqual([
      'dimension',
      'fact',
    ]);
    expect(ecommerce.subcategories[0].explores.map((e) => e.label)).toEqual([
      'Alpha',
      'Beta',
    ]);

    const general = sections.find((s) => s.key === 'general')!;
    expect(general.count).toBe(1);
    expect(general.subcategories).toEqual([
      jasmine.objectContaining({
        key: 'other',
        label: 'Other',
      }),
    ]);

    const support = sections.find((s) => s.key === 'support')!;
    expect(support.subcategories[0].key).toBe('other');

    const risk = sections.find((s) => s.key === 'risk_ops')!;
    expect(risk.label).toBe('Risk ops');
    expect(risk.subcategories[0].label).toBe('Facility events');
  });

  it('returns empty array for empty input', () => {
    expect(groupExploresByTags([])).toEqual([]);
  });
});

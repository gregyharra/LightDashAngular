import { ExploreSummary } from '../../core/models/explore.model';

export type ExploreSectionSubcategory = {
  key: string;
  label: string;
  explores: ExploreSummary[];
};

export type ExploreSection = {
  key: string;
  label: string;
  count: number;
  subcategories: ExploreSectionSubcategory[];
};

/** Title-case a tag key: underscores → spaces, first letter uppercased. */
export function formatTagLabel(tag: string): string {
  if (!tag) {
    return '';
  }
  const spaced = tag.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Group explores by tags[0]=section, tags[1]=subcategory.
 * Fallbacks: section `general`, subcategory `other`.
 * Sections, subcategories, and items are sorted by label.
 */
export function groupExploresByTags(
  explores: ExploreSummary[],
): ExploreSection[] {
  const sectionMap = new Map<
    string,
    Map<string, ExploreSummary[]>
  >();

  for (const explore of explores) {
    const sectionKey = explore.tags[0]?.trim() || 'general';
    const subKey = explore.tags[1]?.trim() || 'other';

    let subMap = sectionMap.get(sectionKey);
    if (!subMap) {
      subMap = new Map();
      sectionMap.set(sectionKey, subMap);
    }

    let items = subMap.get(subKey);
    if (!items) {
      items = [];
      subMap.set(subKey, items);
    }
    items.push(explore);
  }

  return [...sectionMap.entries()]
    .map(([key, subMap]) => {
      const subcategories: ExploreSectionSubcategory[] = [...subMap.entries()]
        .map(([subKey, items]) => ({
          key: subKey,
          label: formatTagLabel(subKey),
          explores: [...items].sort((a, b) =>
            a.label.localeCompare(b.label),
          ),
        }))
        .sort((a, b) => a.label.localeCompare(b.label));

      const count = subcategories.reduce(
        (sum, sub) => sum + sub.explores.length,
        0,
      );

      return {
        key,
        label: formatTagLabel(key),
        count,
        subcategories,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

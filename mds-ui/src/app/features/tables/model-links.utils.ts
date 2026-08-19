import {
  ModelJoinOrigin,
  ModelJoinView,
} from '../../core/models/model-join.model';
import {
  SelectFilterValue,
  TextFilterValue,
  emptySelectFilter,
  emptyTextFilter,
  matchesSelectFilter,
  matchesTextFilter,
} from '../../ui/content-list-filter.utils';

export type LinksTableFilters = {
  sourceModel: TextFilterValue;
  sourceColumn: TextFilterValue;
  targetModel: TextFilterValue;
  targetColumn: TextFilterValue;
  joinType: SelectFilterValue;
  relationship: SelectFilterValue;
  origin: SelectFilterValue;
};

export function createEmptyLinksTableFilters(): LinksTableFilters {
  return {
    sourceModel: emptyTextFilter(),
    sourceColumn: emptyTextFilter(),
    targetModel: emptyTextFilter(),
    targetColumn: emptyTextFilter(),
    joinType: emptySelectFilter(),
    relationship: emptySelectFilter(),
    origin: emptySelectFilter(),
  };
}

export function filterModelJoinViews(
  links: ModelJoinView[],
  filters: LinksTableFilters,
  variant: 'hub' | 'project',
): ModelJoinView[] {
  return links.filter((link) => {
    if (variant === 'project' && !matchesTextFilter(link.sourceModelName, filters.sourceModel)) {
      return false;
    }
    if (!matchesTextFilter(link.sourceColumn, filters.sourceColumn)) {
      return false;
    }
    if (!matchesTextFilter(link.targetModelName, filters.targetModel)) {
      return false;
    }
    if (!matchesTextFilter(link.targetColumn, filters.targetColumn)) {
      return false;
    }
    if (!matchesSelectFilter(link.joinType, filters.joinType)) {
      return false;
    }
    if (!matchesSelectFilter(link.relationship ?? '', filters.relationship)) {
      return false;
    }
    if (!matchesSelectFilter(originLabel(link.origin), filters.origin)) {
      return false;
    }
    return true;
  });
}

export function originLabel(origin: ModelJoinOrigin): string {
  return origin === 'dbt' ? 'dbt meta' : 'custom';
}

export function collectJoinFilterOptions(
  links: ModelJoinView[],
  field: 'joinType' | 'relationship' | 'origin',
): { value: string; label: string }[] {
  const values = new Set<string>();
  for (const link of links) {
    if (field === 'joinType') {
      values.add(link.joinType);
    } else if (field === 'relationship') {
      values.add(link.relationship ?? '');
    } else {
      values.add(originLabel(link.origin));
    }
  }
  return [...values]
    .sort((a, b) => a.localeCompare(b))
    .map((value) => ({
      value,
      label: value === '' ? 'Unset' : value,
    }));
}

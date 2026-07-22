export interface TextFilterValue {
  query: string;
}

export interface SelectFilterValue {
  values: string[];
}

export interface DateFilterValue {
  from: string | null;
  to: string | null;
}

export type NumberFilterOperator =
  | 'equals'
  | 'notEquals'
  | 'lessThan'
  | 'lessThanOrEqual'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'inBetween'
  | 'notInBetween';

export interface NumberFilterValue {
  operator: NumberFilterOperator;
  /** Primary bound (equals / comparisons) or lower bound for between. */
  value: number | null;
  /** Upper bound for between / not-between operators. */
  valueTo: number | null;
}

export interface NumberFilterOperatorOption {
  value: NumberFilterOperator;
  label: string;
}

export const NUMBER_FILTER_OPERATOR_OPTIONS: NumberFilterOperatorOption[] = [
  { value: 'equals', label: 'Equals' },
  { value: 'notEquals', label: 'Not equal' },
  { value: 'lessThan', label: 'Less than' },
  { value: 'lessThanOrEqual', label: 'Less than or equal' },
  { value: 'greaterThan', label: 'Greater than' },
  { value: 'greaterThanOrEqual', label: 'Greater than or equal' },
  { value: 'inBetween', label: 'Between' },
  { value: 'notInBetween', label: 'Not between' },
];

export function numberFilterNeedsTwoValues(operator: NumberFilterOperator): boolean {
  return operator === 'inBetween' || operator === 'notInBetween';
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface ActiveFilterChip {
  key: string;
  label: string;
  displayValue: string;
}

export function emptyTextFilter(): TextFilterValue {
  return { query: '' };
}

export function emptySelectFilter(): SelectFilterValue {
  return { values: [] };
}

export function emptyDateFilter(): DateFilterValue {
  return { from: null, to: null };
}

export function emptyNumberFilter(): NumberFilterValue {
  return { operator: 'equals', value: null, valueTo: null };
}

export function isTextFilterActive(filter: TextFilterValue): boolean {
  return filter.query.trim().length > 0;
}

export function isSelectFilterActive(filter: SelectFilterValue): boolean {
  return filter.values.length > 0;
}

export function isDateFilterActive(filter: DateFilterValue): boolean {
  return filter.from !== null || filter.to !== null;
}

export function isNumberFilterActive(filter: NumberFilterValue): boolean {
  if (numberFilterNeedsTwoValues(filter.operator)) {
    return filter.value !== null && filter.valueTo !== null;
  }
  return filter.value !== null;
}

export function formatTextFilterChip(filter: TextFilterValue): string {
  return filter.query.trim();
}

export function formatSelectFilterChip(
  filter: SelectFilterValue,
  options?: SelectOption[],
): string {
  if (filter.values.length === 0) {
    return '';
  }

  const labelByValue = new Map(options?.map((option) => [option.value, option.label]));
  return filter.values.map((value) => labelByValue.get(value) ?? value).join(', ');
}

export function formatDateFilterChip(filter: DateFilterValue): string {
  if (filter.from && filter.to) {
    return `${filter.from} – ${filter.to}`;
  }
  if (filter.from) {
    return `from ${filter.from}`;
  }
  if (filter.to) {
    return `until ${filter.to}`;
  }
  return '';
}

export function formatNumberFilterChip(filter: NumberFilterValue): string {
  if (!isNumberFilterActive(filter)) {
    return '';
  }

  switch (filter.operator) {
    case 'equals':
      return `= ${filter.value}`;
    case 'notEquals':
      return `≠ ${filter.value}`;
    case 'lessThan':
      return `< ${filter.value}`;
    case 'lessThanOrEqual':
      return `≤ ${filter.value}`;
    case 'greaterThan':
      return `> ${filter.value}`;
    case 'greaterThanOrEqual':
      return `≥ ${filter.value}`;
    case 'inBetween':
      return `${filter.value} – ${filter.valueTo}`;
    case 'notInBetween':
      return `not ${filter.value} – ${filter.valueTo}`;
  }
}

export function collectUniqueSpaces<T>(
  items: T[],
  getSpace: (item: T) => string,
): string[] {
  return collectUniqueValues(items, getSpace);
}

export function collectUniqueValues<T>(
  items: T[],
  getValue: (item: T) => string,
): string[] {
  return [...new Set(items.map(getValue))].sort((a, b) => a.localeCompare(b));
}

export function matchesTextFilter(value: string, filter: TextFilterValue): boolean {
  const query = filter.query.trim().toLowerCase();
  if (!query) {
    return true;
  }
  return value.toLowerCase().includes(query);
}

export function matchesSelectFilter(value: string, filter: SelectFilterValue): boolean {
  if (!isSelectFilterActive(filter)) {
    return true;
  }
  return filter.values.includes(value);
}

function matchesDateFilter(isoDate: string, filter: DateFilterValue): boolean {
  if (!isDateFilterActive(filter)) {
    return true;
  }

  const itemDate = new Date(isoDate);
  if (Number.isNaN(itemDate.getTime())) {
    return false;
  }

  if (filter.from) {
    const from = startOfDay(new Date(filter.from));
    if (itemDate < from) {
      return false;
    }
  }

  if (filter.to) {
    const to = endOfDay(new Date(filter.to));
    if (itemDate > to) {
      return false;
    }
  }

  return true;
}

export function matchesNumberFilter(value: number, filter: NumberFilterValue): boolean {
  if (!isNumberFilterActive(filter)) {
    return true;
  }

  const bound = filter.value as number;
  const boundTo = filter.valueTo as number;

  switch (filter.operator) {
    case 'equals':
      return value === bound;
    case 'notEquals':
      return value !== bound;
    case 'lessThan':
      return value < bound;
    case 'lessThanOrEqual':
      return value <= bound;
    case 'greaterThan':
      return value > bound;
    case 'greaterThanOrEqual':
      return value >= bound;
    case 'inBetween': {
      const low = Math.min(bound, boundTo);
      const high = Math.max(bound, boundTo);
      return value >= low && value <= high;
    }
    case 'notInBetween': {
      const low = Math.min(bound, boundTo);
      const high = Math.max(bound, boundTo);
      return value < low || value > high;
    }
  }
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

/** @deprecated Use column filter helpers instead. */
export function filterByNameAndSpace<T>(
  items: T[],
  options: {
    getName: (item: T) => string;
    getSpace: (item: T) => string;
    searchQuery: string;
    spaceFilter: string | null;
  },
): T[] {
  const query = options.searchQuery.trim().toLowerCase();
  const space = options.spaceFilter;

  return items.filter((item) => {
    if (space && options.getSpace(item) !== space) {
      return false;
    }

    if (query && !options.getName(item).toLowerCase().includes(query)) {
      return false;
    }

    return true;
  });
}

export interface DashboardColumnFilters {
  name: TextFilterValue;
  space: SelectFilterValue;
  lastEdited: DateFilterValue;
  views: NumberFilterValue;
}

export function createEmptyDashboardColumnFilters(): DashboardColumnFilters {
  return {
    name: emptyTextFilter(),
    space: emptySelectFilter(),
    lastEdited: emptyDateFilter(),
    views: emptyNumberFilter(),
  };
}

export function hasActiveDashboardColumnFilters(filters: DashboardColumnFilters): boolean {
  return (
    isTextFilterActive(filters.name) ||
    isSelectFilterActive(filters.space) ||
    isDateFilterActive(filters.lastEdited) ||
    isNumberFilterActive(filters.views)
  );
}

export function getDashboardActiveFilterChips(
  filters: DashboardColumnFilters,
): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];

  if (isTextFilterActive(filters.name)) {
    chips.push({
      key: 'name',
      label: 'Name',
      displayValue: formatTextFilterChip(filters.name),
    });
  }

  if (isSelectFilterActive(filters.space)) {
    chips.push({
      key: 'space',
      label: 'Space',
      displayValue: formatSelectFilterChip(filters.space),
    });
  }

  if (isDateFilterActive(filters.lastEdited)) {
    chips.push({
      key: 'lastEdited',
      label: 'Last edited',
      displayValue: formatDateFilterChip(filters.lastEdited),
    });
  }

  if (isNumberFilterActive(filters.views)) {
    chips.push({
      key: 'views',
      label: 'Views',
      displayValue: formatNumberFilterChip(filters.views),
    });
  }

  return chips;
}

export function filterDashboards<T extends { name: string; spaceName?: string; updatedAt: string; views: number }>(
  items: T[],
  filters: DashboardColumnFilters,
): T[] {
  return items.filter((item) => {
    if (!matchesTextFilter(item.name, filters.name)) {
      return false;
    }

    if (!matchesSelectFilter(item.spaceName ?? 'Shared', filters.space)) {
      return false;
    }

    if (!matchesDateFilter(item.updatedAt, filters.lastEdited)) {
      return false;
    }

    if (!matchesNumberFilter(item.views, filters.views)) {
      return false;
    }

    return true;
  });
}

export interface ChartColumnFilters {
  name: TextFilterValue;
  type: SelectFilterValue;
  table: TextFilterValue;
  space: SelectFilterValue;
  lastEdited: DateFilterValue;
  views: NumberFilterValue;
}

export function createEmptyChartColumnFilters(): ChartColumnFilters {
  return {
    name: emptyTextFilter(),
    type: emptySelectFilter(),
    table: emptyTextFilter(),
    space: emptySelectFilter(),
    lastEdited: emptyDateFilter(),
    views: emptyNumberFilter(),
  };
}

export function hasActiveChartColumnFilters(filters: ChartColumnFilters): boolean {
  return (
    isTextFilterActive(filters.name) ||
    isSelectFilterActive(filters.type) ||
    isTextFilterActive(filters.table) ||
    isSelectFilterActive(filters.space) ||
    isDateFilterActive(filters.lastEdited) ||
    isNumberFilterActive(filters.views)
  );
}

export function getChartActiveFilterChips(
  filters: ChartColumnFilters,
  typeOptions: SelectOption[],
): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];

  if (isTextFilterActive(filters.name)) {
    chips.push({
      key: 'name',
      label: 'Name',
      displayValue: formatTextFilterChip(filters.name),
    });
  }

  if (isSelectFilterActive(filters.type)) {
    chips.push({
      key: 'type',
      label: 'Type',
      displayValue: formatSelectFilterChip(filters.type, typeOptions),
    });
  }

  if (isTextFilterActive(filters.table)) {
    chips.push({
      key: 'table',
      label: 'Table',
      displayValue: formatTextFilterChip(filters.table),
    });
  }

  if (isSelectFilterActive(filters.space)) {
    chips.push({
      key: 'space',
      label: 'Space',
      displayValue: formatSelectFilterChip(filters.space),
    });
  }

  if (isDateFilterActive(filters.lastEdited)) {
    chips.push({
      key: 'lastEdited',
      label: 'Last edited',
      displayValue: formatDateFilterChip(filters.lastEdited),
    });
  }

  if (isNumberFilterActive(filters.views)) {
    chips.push({
      key: 'views',
      label: 'Views',
      displayValue: formatNumberFilterChip(filters.views),
    });
  }

  return chips;
}

export function filterCharts<
  T extends {
    name: string;
    chartKind: string;
    tableName: string;
    spaceName: string;
    updatedAt: string;
    views: number;
  },
>(items: T[], filters: ChartColumnFilters): T[] {
  return items.filter((item) => {
    if (!matchesTextFilter(item.name, filters.name)) {
      return false;
    }

    if (!matchesSelectFilter(item.chartKind, filters.type)) {
      return false;
    }

    if (!matchesTextFilter(item.tableName, filters.table)) {
      return false;
    }

    if (!matchesSelectFilter(item.spaceName, filters.space)) {
      return false;
    }

    if (!matchesDateFilter(item.updatedAt, filters.lastEdited)) {
      return false;
    }

    if (!matchesNumberFilter(item.views, filters.views)) {
      return false;
    }

    return true;
  });
}

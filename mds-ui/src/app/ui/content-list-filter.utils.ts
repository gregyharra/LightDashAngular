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

export interface NumberFilterValue {
  min: number | null;
  max: number | null;
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
  return { min: null, max: null };
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
  return filter.min !== null || filter.max !== null;
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
  if (filter.min !== null && filter.max !== null) {
    return `${filter.min} – ${filter.max}`;
  }
  if (filter.min !== null) {
    return `≥ ${filter.min}`;
  }
  if (filter.max !== null) {
    return `≤ ${filter.max}`;
  }
  return '';
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

function matchesTextFilter(value: string, filter: TextFilterValue): boolean {
  const query = filter.query.trim().toLowerCase();
  if (!query) {
    return true;
  }
  return value.toLowerCase().includes(query);
}

function matchesSelectFilter(value: string, filter: SelectFilterValue): boolean {
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

function matchesNumberFilter(value: number, filter: NumberFilterValue): boolean {
  if (!isNumberFilterActive(filter)) {
    return true;
  }

  if (filter.min !== null && value < filter.min) {
    return false;
  }

  if (filter.max !== null && value > filter.max) {
    return false;
  }

  return true;
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

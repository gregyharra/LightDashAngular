import { Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import {
  DpfProjectSidenavComponent,
  DpfProjectSidenavItem,
} from '../../shared/ui';

export type ProjectBrowseNavActive =
  | 'explore'
  | 'dashboards'
  | 'charts'
  | 'tables'
  | 'lineage';

interface BrowseNavItemConfig {
  id: ProjectBrowseNavActive;
  path: string;
  icon: string;
  labelKey: string;
}

const BROWSE_NAV_ITEMS: readonly BrowseNavItemConfig[] = [
  {
    id: 'explore',
    path: 'explore',
    icon: 'search',
    labelKey: 'explorer.title',
  },
  {
    id: 'dashboards',
    path: 'dashboards',
    icon: 'dashboard',
    labelKey: 'nav.dashboard',
  },
  {
    id: 'charts',
    path: 'charts',
    icon: 'bar_chart',
    labelKey: 'nav.graph',
  },
  {
    id: 'tables',
    path: 'tables',
    icon: 'table_chart',
    labelKey: 'tables.title',
  },
  {
    id: 'lineage',
    path: 'lineage',
    icon: 'account_tree',
    labelKey: 'lineage.title',
  },
];

const TRANSLATION_KEYS = [
  'nav.home',
  'nav.browseNavigation',
  ...BROWSE_NAV_ITEMS.map((item) => item.labelKey),
];

@Component({
  selector: 'app-project-browse-nav',
  imports: [DpfProjectSidenavComponent],
  template: `
    <dpf-project-sidenav
      [projectUuid]="projectUuid()"
      [active]="active()"
      [items]="items()"
      [homeLabel]="translations()['nav.home']"
      [navigationLabel]="translations()['nav.browseNavigation']"
    />
  `,
})
export class ProjectBrowseNavComponent {
  private readonly translate = inject(TranslateService);

  readonly projectUuid = input.required<string>();
  readonly active = input.required<ProjectBrowseNavActive>();

  protected readonly translations = toSignal(
    this.translate.stream(TRANSLATION_KEYS),
    {
      initialValue: this.translate.instant(TRANSLATION_KEYS) as Record<
        string,
        string
      >,
    },
  );

  protected readonly items = computed<readonly DpfProjectSidenavItem[]>(() =>
    BROWSE_NAV_ITEMS.map(({ labelKey, ...item }) => ({
      ...item,
      label: this.translations()[labelKey],
    })),
  );
}

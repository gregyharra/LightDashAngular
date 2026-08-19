import { Component, computed, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import {
  LinkDialogMode,
  ModelJoinView,
} from '../../../core/models/model-join.model';
import {
  ColumnFilterValue,
  ContentListColumnHeaderComponent,
} from '../../../ui/content-list-column-header/content-list-column-header.component';
import {
  collectJoinFilterOptions,
  createEmptyLinksTableFilters,
  filterModelJoinViews,
  LinksTableFilters,
  originLabel,
} from '../model-links.utils';

@Component({
  selector: 'app-filterable-links-table',
  imports: [MatButtonModule, MatIconModule, ContentListColumnHeaderComponent],
  templateUrl: './filterable-links-table.component.html',
  styleUrl: './filterable-links-table.component.scss',
})
export class FilterableLinksTableComponent {
  readonly variant = input.required<LinkDialogMode>();
  readonly links = input.required<ModelJoinView[]>();
  readonly loading = input(false);
  readonly saving = input(false);

  readonly addRequested = output<void>();
  readonly editRequested = output<ModelJoinView>();
  readonly deleteRequested = output<ModelJoinView>();

  protected readonly filters = signal<LinksTableFilters>(createEmptyLinksTableFilters());

  protected readonly filteredLinks = computed(() =>
    filterModelJoinViews(this.links(), this.filters(), this.variant()),
  );

  protected readonly joinTypeOptions = computed(() =>
    collectJoinFilterOptions(this.links(), 'joinType'),
  );
  protected readonly relationshipOptions = computed(() =>
    collectJoinFilterOptions(this.links(), 'relationship'),
  );
  protected readonly originOptions = computed(() =>
    collectJoinFilterOptions(this.links(), 'origin'),
  );

  protected readonly showSourceModel = computed(() => this.variant() === 'project');

  protected originLabel = originLabel;

  protected updateFilter<K extends keyof LinksTableFilters>(
    key: K,
    value: ColumnFilterValue,
  ): void {
    this.filters.update((current) => ({
      ...current,
      [key]: value as LinksTableFilters[K],
    }));
  }

  protected onEdit(link: ModelJoinView): void {
    if (link.origin !== 'custom') {
      return;
    }
    this.editRequested.emit(link);
  }

  protected onDelete(link: ModelJoinView): void {
    if (link.origin !== 'custom') {
      return;
    }
    this.deleteRequested.emit(link);
  }
}

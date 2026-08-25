import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  LinkDialogMode,
  ModelJoinView,
} from '../../../core/models/model-join.model';
import { filterModelJoinViews } from '../model-links.utils';

@Component({
  selector: 'app-filterable-links-table',
  imports: [FormsModule, MatButtonModule, MatIconModule, MatTooltipModule, TranslatePipe],
  templateUrl: './filterable-links-table.component.html',
  styleUrl: './filterable-links-table.component.scss',
})
export class FilterableLinksTableComponent {
  private readonly translate = inject(TranslateService);
  readonly variant = input.required<LinkDialogMode>();
  readonly links = input.required<ModelJoinView[]>();
  readonly loading = input(false);
  readonly saving = input(false);

  readonly addRequested = output<void>();
  readonly editRequested = output<ModelJoinView>();
  readonly deleteRequested = output<ModelJoinView>();

  protected readonly searchQuery = signal('');

  protected readonly filteredLinks = computed(() =>
    filterModelJoinViews(this.links(), this.searchQuery(), this.variant()),
  );

  protected readonly showSourceModel = computed(() => this.variant() === 'project');

  protected displayOriginLabel(origin: ModelJoinView['origin']): string {
    return this.translate.instant(
      origin === 'dbt' ? 'tables.links.origins.dbt' : 'tables.links.origins.custom',
    );
  }

  protected onSearchInput(value: string): void {
    this.searchQuery.set(value);
  }

  protected clearSearch(): void {
    this.searchQuery.set('');
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

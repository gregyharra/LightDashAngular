import { Component, input, output } from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';
import {
  ExploreJoinIssue,
  FieldId,
} from '../../core/models/explore.model';

/** Model section for chart edit / Explore fields sidebars. */
export type ChartFieldsAccordionGroup = {
  trackKey: string;
  table: { name: string; label: string };
  dimensions: { fieldId: FieldId; label: string }[];
  metrics: { fieldId: FieldId; label: string }[];
  issue?: ExploreJoinIssue;
};

/**
 * Encapsulated joined-model fields list used by chart edit.
 * Shared so Explore can render the same collapsible model sections.
 */
@Component({
  selector: 'app-chart-fields-accordion',
  imports: [MatExpansionModule, MatIconModule, MatTooltipModule, TranslatePipe],
  templateUrl: './chart-fields-accordion.component.html',
  styleUrl: './chart-fields-accordion.component.scss',
})
export class ChartFieldsAccordionComponent {
  readonly fieldGroups = input<ChartFieldsAccordionGroup[]>([]);
  readonly selectedFieldIds = input<ReadonlySet<FieldId>>(new Set());
  /** When true and groups are empty, show the empty search message. */
  readonly showEmpty = input(false);
  readonly showCustomMetricAdd = input(false);
  readonly canCreateCustomMetric = input(false);

  readonly fieldToggled = output<FieldId>();
  readonly customMetricAdd = output<void>();

  protected isFieldSelected(fieldId: FieldId): boolean {
    return this.selectedFieldIds().has(fieldId);
  }

  protected toggleField(fieldId: FieldId): void {
    this.fieldToggled.emit(fieldId);
  }

  protected issueTooltip(issue: ExploreJoinIssue): string {
    return `${issue.message}${issue.suggestion ? ` Did you mean ${issue.suggestion}?` : ''}`;
  }

  protected onCustomMetricAdd(): void {
    if (!this.showCustomMetricAdd() || !this.canCreateCustomMetric()) {
      return;
    }
    this.customMetricAdd.emit();
  }
}

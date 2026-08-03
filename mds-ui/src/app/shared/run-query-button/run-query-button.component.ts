import { Component, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  clampQueryLimit,
  resolveMaxQueryLimit,
} from '../../features/explorer/query-limit.utils';

@Component({
  selector: 'app-run-query-button',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './run-query-button.component.html',
  styleUrl: './run-query-button.component.scss',
})
export class RunQueryButtonComponent {
  readonly limit = input.required<number>();
  readonly maxLimit = input<number | null | undefined>(undefined);
  readonly disabled = input(false);
  readonly loading = input(false);
  readonly showLabel = input(true);

  readonly run = output<void>();
  readonly limitChange = output<number>();

  protected readonly draftLimit = signal(500);

  constructor() {
    effect(() => {
      this.draftLimit.set(this.limit());
    });
  }

  protected readonly resolvedMaxLimit = () => resolveMaxQueryLimit(this.maxLimit());

  protected runLabel(): string {
    return `Run query (${this.limit()})`;
  }

  protected onRun(): void {
    if (this.disabled() || this.loading()) {
      return;
    }
    this.run.emit();
  }

  protected onDraftLimitChange(value: number | string | null): void {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(parsed)) {
      this.draftLimit.set(Math.floor(parsed));
    }
  }

  protected commitLimit(): void {
    const next = clampQueryLimit(this.draftLimit(), this.maxLimit());
    this.draftLimit.set(next);
    if (next !== this.limit()) {
      this.limitChange.emit(next);
    }
  }

  protected onLimitKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.commitLimit();
    }
  }
}

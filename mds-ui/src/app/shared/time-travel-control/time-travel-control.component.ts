import { Component, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TimeTravelConfig } from '../../core/models/explore.model';
import {
  formatTimeTravelLabel,
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from '../../features/explorer/time-travel.utils';

@Component({
  selector: 'app-time-travel-control',
  imports: [FormsModule, MatButtonModule, MatIconModule],
  templateUrl: './time-travel-control.component.html',
  styleUrl: './time-travel-control.component.scss',
})
export class TimeTravelControlComponent {
  readonly value = input<TimeTravelConfig | null>(null);
  readonly compact = input(false);

  readonly valueChange = output<TimeTravelConfig | null>();

  protected readonly datetimeLocal = signal('');
  protected readonly formatTimeTravelLabel = formatTimeTravelLabel;

  constructor() {
    effect(() => {
      const external = toDatetimeLocalValue(this.value()?.asOfTimestamp);
      if (external !== this.datetimeLocal()) {
        this.datetimeLocal.set(external);
      }
    });
  }

  resolveValue(): TimeTravelConfig | null {
    return this.toTimeTravelConfig(this.datetimeLocal());
  }

  protected onDatetimeChange(rawValue: string): void {
    this.datetimeLocal.set(rawValue);
    this.valueChange.emit(this.toTimeTravelConfig(rawValue));
  }

  protected clearTimeTravel(): void {
    this.datetimeLocal.set('');
    this.valueChange.emit(null);
  }

  private toTimeTravelConfig(rawValue: string): TimeTravelConfig | null {
    const iso = fromDatetimeLocalValue(rawValue);
    if (!iso) {
      return null;
    }

    return { asOfTimestamp: iso };
  }
}

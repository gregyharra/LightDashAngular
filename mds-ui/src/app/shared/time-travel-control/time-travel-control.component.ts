import { Component, input, output } from '@angular/core';
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

  protected readonly formatTimeTravelLabel = formatTimeTravelLabel;

  protected onDatetimeChange(rawValue: string): void {
    const iso = fromDatetimeLocalValue(rawValue);
    if (!iso) {
      this.valueChange.emit(null);
      return;
    }

    this.valueChange.emit({ asOfTimestamp: iso });
  }

  protected clearTimeTravel(): void {
    this.valueChange.emit(null);
  }

  protected inputValue(): string {
    return toDatetimeLocalValue(this.value()?.asOfTimestamp);
  }
}

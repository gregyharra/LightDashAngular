import { Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { ActiveFilterChip } from '../content-list-filter.utils';

@Component({
  selector: 'app-content-list-filter-chips',
  imports: [MatIconModule, TranslatePipe],
  templateUrl: './content-list-filter-chips.component.html',
  styleUrl: './content-list-filter-chips.component.scss',
})
export class ContentListFilterChipsComponent {
  readonly chips = input<ActiveFilterChip[]>([]);

  readonly clearChip = output<string>();
  readonly clearAll = output<void>();
}

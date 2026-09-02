import { Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { ActiveFilterChip } from '../../utils/content-list-filter.utils';

@Component({
  selector: 'ld-content-list-filter-chips',
  imports: [MatIconModule, TranslatePipe],
  templateUrl: './ld-content-list-filter-chips.component.html',
  styleUrl: './ld-content-list-filter-chips.component.scss',
})
export class LdContentListFilterChipsComponent {
  readonly chips = input<ActiveFilterChip[]>([]);

  readonly clearChip = output<string>();
  readonly clearAll = output<void>();
}

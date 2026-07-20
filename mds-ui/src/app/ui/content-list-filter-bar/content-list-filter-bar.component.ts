import {
  Component,
  DestroyRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-content-list-filter-bar',
  imports: [FormsModule, MatFormFieldModule, MatIconModule, MatSelectModule],
  templateUrl: './content-list-filter-bar.component.html',
  styleUrl: './content-list-filter-bar.component.scss',
})
export class ContentListFilterBarComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly searchInput$ = new Subject<string>();

  readonly searchPlaceholder = input('Search by name…');
  readonly spaces = input<string[]>([]);
  readonly spaceFilterLabel = input('Space');

  readonly searchChange = output<string>();
  readonly spaceChange = output<string | null>();

  protected readonly searchInput = signal('');
  protected readonly spaceFilter = signal<string | null>(null);

  constructor() {
    this.searchInput$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.searchChange.emit(value);
      });
  }

  protected onSearchInput(value: string): void {
    this.searchInput.set(value);
    this.searchInput$.next(value);
  }

  protected onSpaceChange(value: string | null): void {
    this.spaceFilter.set(value);
    this.spaceChange.emit(value);
  }

  protected clearSearch(): void {
    this.onSearchInput('');
  }

  protected clearSpace(): void {
    this.onSpaceChange(null);
  }

  protected clearAll(): void {
    this.clearSearch();
    this.clearSpace();
  }

  protected hasActiveFilters(): boolean {
    return this.searchInput().trim().length > 0 || this.spaceFilter() !== null;
  }
}

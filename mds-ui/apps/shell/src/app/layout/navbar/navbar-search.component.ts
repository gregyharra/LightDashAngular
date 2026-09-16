import { NgStyle } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Subject, Subscription, combineLatest, of } from 'rxjs';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  map,
  switchMap,
  tap,
} from 'rxjs/operators';
import { ActiveProjectService } from '../../core/services/active-project.service';
import { TransformationChipComponent } from '../../features/lineage/transformation-chip/transformation-chip.component';
import {
  NavbarSearchGroup,
  NavbarSearchResult,
  NavbarSearchService,
} from './navbar-search.service';

@Component({
  selector: 'app-navbar-search',
  imports: [
    FormsModule,
    MatIconModule,
    MatProgressSpinnerModule,
    NgStyle,
    TranslatePipe,
    TransformationChipComponent,
  ],
  templateUrl: './navbar-search.component.html',
  styleUrl: './navbar-search.component.scss',
})
export class NavbarSearchComponent implements OnDestroy {
  protected readonly activeProjectService = inject(ActiveProjectService);
  private readonly searchService = inject(NavbarSearchService);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly translate = inject(TranslateService);

  @ViewChild('searchInput') private readonly searchInput?: ElementRef<HTMLInputElement>;
  @ViewChild('resultsPanel') private readonly resultsPanel?: ElementRef<HTMLElement>;

  protected readonly searchExpanded = signal(false);
  protected readonly query = signal('');
  protected readonly open = signal(false);
  protected readonly loading = signal(false);
  protected readonly groups = signal<NavbarSearchGroup[]>([]);
  protected readonly activeIndex = signal(-1);
  protected readonly panelStyle = signal<Record<string, string>>({});

  protected readonly flatResults = computed(() =>
    this.groups().flatMap((group) => group.results),
  );

  protected readonly showEmpty = computed(
    () =>
      this.open() &&
      !this.loading() &&
      this.query().trim().length > 0 &&
      this.flatResults().length === 0,
  );

  private readonly query$ = new Subject<string>();
  private readonly projectUuid$ = toObservable(this.activeProjectService.activeProjectUuid);
  private readonly searchSub: Subscription;
  private cachedProjectUuid: string | null = null;

  constructor() {
    this.searchSub = combineLatest([
      this.query$.pipe(debounceTime(250), distinctUntilChanged()),
      this.projectUuid$,
    ])
      .pipe(
        tap(([value]) => {
          const trimmed = value.trim();
          if (!trimmed) {
            this.loading.set(false);
            this.groups.set([]);
            this.activeIndex.set(-1);
            this.open.set(false);
          } else {
            this.loading.set(true);
            this.open.set(true);
          }
        }),
        switchMap(([value, projectUuid]) => {
          const trimmed = value.trim();
          if (!projectUuid || !trimmed) {
            return of({ projectUuid, groups: [] as NavbarSearchGroup[] });
          }
          return this.searchService.search(projectUuid, trimmed).pipe(
            map((groups) => ({ projectUuid, groups })),
            catchError(() => of({ projectUuid, groups: [] as NavbarSearchGroup[] })),
          );
        }),
      )
      .subscribe(({ projectUuid, groups }) => {
        // Drop stale responses if the active project or query changed mid-flight.
        if (projectUuid !== this.activeProjectService.activeProjectUuid()) {
          return;
        }
        if (!this.query().trim()) {
          this.groups.set([]);
          this.loading.set(false);
          this.activeIndex.set(-1);
          return;
        }
        this.groups.set(groups);
        this.loading.set(false);
        this.activeIndex.set(groups.length > 0 ? 0 : -1);
        this.open.set(true);
        this.updatePanelPosition();
      });

    effect(() => {
      const projectUuid = this.activeProjectService.activeProjectUuid();
      if (projectUuid !== this.cachedProjectUuid) {
        if (this.cachedProjectUuid) {
          this.searchService.clearCache(this.cachedProjectUuid);
        }
        this.cachedProjectUuid = projectUuid;
        this.resetSearchState();
      }
    });
  }

  ngOnDestroy(): void {
    this.searchSub.unsubscribe();
  }

  protected searchPlaceholder(projectName: string): string {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches) {
      return this.translate.instant('nav.search');
    }
    return this.translate.instant('nav.searchProjectName', { projectName });
  }

  protected toggleSearchExpanded(): void {
    this.searchExpanded.update((expanded) => !expanded);
    if (!this.searchExpanded()) {
      this.closePanel();
      return;
    }
    queueMicrotask(() => this.searchInput?.nativeElement.focus());
  }

  protected closeSearchExpanded(): void {
    this.searchExpanded.set(false);
    this.closePanel();
  }

  protected onQueryInput(value: string): void {
    this.query.set(value);
    this.query$.next(value);
    if (value.trim()) {
      this.updatePanelPosition();
    }
  }

  protected onFocus(): void {
    if (this.query().trim() && (this.flatResults().length > 0 || this.showEmpty() || this.loading())) {
      this.open.set(true);
      this.updatePanelPosition();
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (this.open()) {
        this.closePanel();
      } else if (this.searchExpanded()) {
        this.closeSearchExpanded();
      } else {
        this.searchInput?.nativeElement.blur();
      }
      return;
    }

    const results = this.flatResults();
    if (!this.open() || results.length === 0) {
      if (event.key === 'ArrowDown' && this.query().trim()) {
        this.open.set(true);
        this.updatePanelPosition();
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activeIndex.update((index) => (index + 1) % results.length);
      this.scrollActiveIntoView();
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeIndex.update((index) => (index <= 0 ? results.length - 1 : index - 1));
      this.scrollActiveIntoView();
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const active = results[this.activeIndex()];
      if (active) {
        this.selectResult(active);
      }
    }
  }

  protected isActive(result: NavbarSearchResult): boolean {
    const results = this.flatResults();
    const index = this.activeIndex();
    return index >= 0 && results[index]?.id === result.id;
  }

  protected selectResult(result: NavbarSearchResult): void {
    void this.router.navigate(result.route);
    this.resetSearchState();
    this.searchExpanded.set(false);
  }

  protected flatIndexOf(result: NavbarSearchResult): number {
    return this.flatResults().findIndex((item) => item.id === result.id);
  }

  protected setActiveFromPointer(result: NavbarSearchResult): void {
    const index = this.flatIndexOf(result);
    if (index >= 0) {
      this.activeIndex.set(index);
    }
  }

  @HostListener('document:keydown.escape')
  protected onDocumentEscape(): void {
    if (this.open()) {
      this.closePanel();
      return;
    }
    if (this.searchExpanded()) {
      this.closeSearchExpanded();
    }
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node | null;
    if (!target) {
      return;
    }
    if (this.host.nativeElement.contains(target)) {
      return;
    }
    if (this.resultsPanel?.nativeElement.contains(target)) {
      return;
    }
    this.closePanel();
  }

  @HostListener('window:resize')
  protected onWindowResize(): void {
    if (this.open()) {
      this.updatePanelPosition();
    }
  }

  private closePanel(): void {
    this.open.set(false);
    this.activeIndex.set(-1);
  }

  private resetSearchState(): void {
    this.query.set('');
    this.query$.next('');
    this.groups.set([]);
    this.loading.set(false);
    this.closePanel();
  }

  private updatePanelPosition(): void {
    const input = this.searchInput?.nativeElement;
    if (!input || typeof window === 'undefined') {
      return;
    }

    const rect = input.getBoundingClientRect();
    const field = input.closest('.navbar-search__field') as HTMLElement | null;
    const fieldRect = field?.getBoundingClientRect() ?? rect;
    const width = Math.min(Math.max(fieldRect.width, 280), Math.min(440, window.innerWidth - 16));
    let left = fieldRect.left;
    if (left + width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - width - 8);
    }

    this.panelStyle.set({
      top: `${Math.round(fieldRect.bottom + 6)}px`,
      left: `${Math.round(left)}px`,
      width: `${Math.round(width)}px`,
    });
  }

  private scrollActiveIntoView(): void {
    queueMicrotask(() => {
      const panel = this.resultsPanel?.nativeElement;
      const active = panel?.querySelector('.navbar-search__item--active');
      active?.scrollIntoView({ block: 'nearest' });
    });
  }
}

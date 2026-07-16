import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  DestroyRef,
  PLATFORM_ID,
  Renderer2,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Explore, FieldId } from '../../../core/models/explore.model';

export type TablesFieldGroup = {
  table: { name: string; label: string };
  dimensions: { fieldId: FieldId; label: string; type: string }[];
  metrics: { fieldId: FieldId; label: string }[];
};

const COLLAPSED_STORAGE_KEY = 'lightdash-tables-fields-panel-collapsed';
const WIDTH_STORAGE_KEY = 'lightdash-tables-fields-panel-width';
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;
const COLLAPSED_WIDTH = 44;

@Component({
  selector: 'app-tables-fields-panel',
  host: {
    class: 'tables-fields-panel-host',
  },
  imports: [RouterLink, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './tables-fields-panel.component.html',
  styleUrl: './tables-fields-panel.component.scss',
})
export class TablesFieldsPanelComponent {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly renderer = inject(Renderer2);
  private readonly destroyRef = inject(DestroyRef);

  readonly projectUuid = input.required<string>();
  readonly tableId = input.required<string>();
  readonly tableLabel = input.required<string>();
  readonly fieldSearch = input('');
  readonly fieldGroups = input<TablesFieldGroup[]>([]);
  readonly exploreLoading = input(false);
  readonly exploreError = input<string | null>(null);
  readonly hasExplore = input(false);
  readonly selectedFieldIds = input<ReadonlySet<FieldId>>(new Set());
  readonly resizable = input(true);

  readonly fieldSearchChange = output<string>();
  readonly fieldToggled = output<FieldId>();

  protected readonly collapsed = signal(false);
  protected readonly panelWidth = signal(DEFAULT_WIDTH);
  protected readonly resizing = signal(false);
  protected readonly collapsedWidth = COLLAPSED_WIDTH;

  private isDragging = false;
  private startX = 0;
  private startWidth = 0;
  private unlistenMove?: () => void;
  private unlistenUp?: () => void;

  constructor() {
    this.collapsed.set(this.readCollapsedState());
    if (isPlatformBrowser(this.platformId)) {
      this.panelWidth.set(this.readSavedWidth());
    }

    this.destroyRef.onDestroy(() => {
      this.stopResize();
    });
  }

  protected onFieldSearch(value: string): void {
    this.fieldSearchChange.emit(value);
  }

  protected toggleCollapsed(): void {
    const next = !this.collapsed();
    this.collapsed.set(next);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(COLLAPSED_STORAGE_KEY, String(next));
    }
  }

  protected onResizeStart(event: PointerEvent): void {
    if (!this.resizable() || this.collapsed()) {
      return;
    }

    const handle = event.currentTarget as HTMLElement;
    event.preventDefault();
    this.isDragging = true;
    this.resizing.set(true);
    this.startX = event.clientX;
    this.startWidth = this.panelWidth();
    handle.setPointerCapture(event.pointerId);
    this.renderer.addClass(document.body, 'tables-fields-panel--resizing');

    this.unlistenMove = this.renderer.listen('document', 'pointermove', (moveEvent: PointerEvent) =>
      this.onResizeMove(moveEvent),
    );
    this.unlistenUp = this.renderer.listen('document', 'pointerup', (upEvent: PointerEvent) =>
      this.onResizeEnd(upEvent, handle),
    );
  }

  private onResizeMove(event: PointerEvent): void {
    if (!this.isDragging || this.collapsed()) {
      return;
    }

    const width = this.clamp(this.startWidth + (event.clientX - this.startX));
    this.panelWidth.set(width);
  }

  private onResizeEnd(event: PointerEvent, handle: HTMLElement): void {
    if (!this.isDragging) {
      return;
    }

    handle.releasePointerCapture(event.pointerId);
    this.stopResize();

    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(WIDTH_STORAGE_KEY, String(this.panelWidth()));
    }
  }

  private stopResize(): void {
    this.isDragging = false;
    this.resizing.set(false);
    this.renderer.removeClass(document.body, 'tables-fields-panel--resizing');
    this.unlistenMove?.();
    this.unlistenUp?.();
    this.unlistenMove = undefined;
    this.unlistenUp = undefined;
  }

  protected isFieldSelected(fieldId: FieldId): boolean {
    return this.selectedFieldIds().has(fieldId);
  }

  protected toggleField(fieldId: FieldId): void {
    this.fieldToggled.emit(fieldId);
  }

  private readCollapsedState(): boolean {
    if (!isPlatformBrowser(this.platformId)) {
      return false;
    }
    return localStorage.getItem(COLLAPSED_STORAGE_KEY) === 'true';
  }

  private readSavedWidth(): number {
    const saved = localStorage.getItem(WIDTH_STORAGE_KEY);
    const parsed = saved ? Number.parseInt(saved, 10) : Number.NaN;
    return Number.isFinite(parsed) ? this.clamp(parsed) : DEFAULT_WIDTH;
  }

  private clamp(width: number): number {
    return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width));
  }
}

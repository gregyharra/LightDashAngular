import {
  Directive,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  clampTilePosition,
  DashboardTilePosition,
  DASHBOARD_GRID_COLS,
  pixelDeltaToGridDelta,
} from './dashboard-grid.constants';

type InteractionMode = 'drag' | 'resize';

const DRAG_THRESHOLD_PX = 4;

@Directive({
  selector: '[appDashboardTileGridInteraction]',
  host: {
    '[class.dashboard-edit__tile-wrap--dragging]': 'isDragging()',
    '[class.dashboard-edit__tile-wrap--resizing]': 'isResizing()',
  },
})
export class DashboardTileGridInteractionDirective {
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly tilePosition = input.required<DashboardTilePosition>({ alias: 'appDashboardTileGridInteraction' });
  readonly gridElement = input.required<HTMLElement>();
  readonly disabled = input(false);

  readonly tilePositionChange = output<DashboardTilePosition>();

  protected readonly isDragging = signal(false);
  protected readonly isResizing = signal(false);

  private mode: InteractionMode | null = null;
  private pointerId: number | null = null;
  private startClientX = 0;
  private startClientY = 0;
  private startPosition: DashboardTilePosition | null = null;
  private moved = false;

  @HostListener('pointerdown', ['$event'])
  onPointerDown(event: PointerEvent): void {
    if (this.disabled() || event.button !== 0) {
      return;
    }

    const target = event.target as HTMLElement | null;
    const nonDraggable = target?.closest('.non-draggable');
    const resizeHandle = target?.closest('.dashboard-edit__tile-resize-handle');

    if (nonDraggable && !resizeHandle) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    this.mode = resizeHandle ? 'resize' : 'drag';
    this.pointerId = event.pointerId;
    this.startClientX = event.clientX;
    this.startClientY = event.clientY;
    this.startPosition = { ...this.tilePosition() };
    this.moved = false;

    if (this.mode === 'drag') {
      this.isDragging.set(true);
    } else {
      this.isResizing.set(true);
    }

    this.host.nativeElement.setPointerCapture(event.pointerId);
  }

  @HostListener('pointermove', ['$event'])
  onPointerMove(event: PointerEvent): void {
    if (this.mode === null || this.pointerId !== event.pointerId || !this.startPosition) {
      return;
    }

    const deltaX = event.clientX - this.startClientX;
    const deltaY = event.clientY - this.startClientY;

    if (
      !this.moved &&
      (Math.abs(deltaX) > DRAG_THRESHOLD_PX || Math.abs(deltaY) > DRAG_THRESHOLD_PX)
    ) {
      this.moved = true;
    }

    if (!this.moved) {
      return;
    }

    const gridWidth = this.gridElement().getBoundingClientRect().width;
    const { dx, dy } = pixelDeltaToGridDelta(deltaX, deltaY, gridWidth);
    const nextPosition =
      this.mode === 'drag'
        ? clampTilePosition({
            ...this.startPosition,
            x: this.startPosition.x + dx,
            y: this.startPosition.y + dy,
          })
        : clampTilePosition({
            ...this.startPosition,
            w: this.startPosition.w + dx,
            h: this.startPosition.h + dy,
          });

    this.tilePositionChange.emit(nextPosition);
  }

  @HostListener('pointerup', ['$event'])
  onPointerUp(event: PointerEvent): void {
    this.finishInteraction(event);
  }

  @HostListener('pointercancel', ['$event'])
  onPointerCancel(event: PointerEvent): void {
    this.finishInteraction(event);
  }

  private finishInteraction(event: PointerEvent): void {
    if (this.mode === null || this.pointerId !== event.pointerId) {
      return;
    }

    if (this.host.nativeElement.hasPointerCapture(event.pointerId)) {
      this.host.nativeElement.releasePointerCapture(event.pointerId);
    }

    this.mode = null;
    this.pointerId = null;
    this.startPosition = null;
    this.isDragging.set(false);
    this.isResizing.set(false);

    if (this.moved) {
      event.preventDefault();
      event.stopPropagation();
    }

    this.moved = false;
  }
}

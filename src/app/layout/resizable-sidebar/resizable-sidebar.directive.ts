import { isPlatformBrowser } from '@angular/common';
import {
  DestroyRef,
  Directive,
  ElementRef,
  OnInit,
  PLATFORM_ID,
  Renderer2,
  inject,
} from '@angular/core';

const WIDTH_STORAGE_KEY = 'lightdash-sidebar-width';
const COLLAPSED_STORAGE_KEY = 'lightdash-page-sidebar-collapsed';
const DEFAULT_WIDTH = 300;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;
const COLLAPSED_WIDTH = 44;

@Directive({
  selector: '[appResizableSidebar]',
  standalone: true,
})
export class ResizableSidebarDirective implements OnInit {
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly renderer = inject(Renderer2);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);

  private isDragging = false;
  private startX = 0;
  private startWidth = 0;
  private collapsed = false;
  private unlistenMove?: () => void;
  private unlistenUp?: () => void;
  private resizeHandle?: HTMLElement;
  private foldButton?: HTMLElement;
  private pageSidebar?: HTMLElement;

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.pageSidebar = this.el.nativeElement.querySelector('.page-sidebar') ?? undefined;
    this.collapsed = localStorage.getItem(COLLAPSED_STORAGE_KEY) === 'true';

    const savedWidth = this.readSavedWidth();
    this.applyWidth(this.collapsed ? COLLAPSED_WIDTH : savedWidth);
    this.applyCollapsedState(this.collapsed);

    this.foldButton = this.renderer.createElement('button');
    this.renderer.setAttribute(this.foldButton, 'type', 'button');
    this.renderer.addClass(this.foldButton, 'page-sidebar__fold-btn');
    this.renderer.setAttribute(this.foldButton, 'aria-label', this.foldAriaLabel());
    this.renderer.setAttribute(
      this.foldButton,
      'aria-expanded',
      String(!this.collapsed),
    );
    this.updateFoldIcon();
    this.renderer.listen(this.foldButton, 'click', () => this.toggleCollapsed());

    const foldTarget = this.pageSidebar ?? this.el.nativeElement;
    this.renderer.appendChild(foldTarget, this.foldButton);

    this.resizeHandle = this.renderer.createElement('div');
    this.renderer.addClass(this.resizeHandle, 'page-sidebar__resize-handle');
    this.renderer.setAttribute(this.resizeHandle, 'role', 'separator');
    this.renderer.setAttribute(this.resizeHandle, 'aria-orientation', 'vertical');
    this.renderer.setAttribute(this.resizeHandle, 'aria-label', 'Resize sidebar');
    this.renderer.setAttribute(this.resizeHandle, 'tabindex', '0');
    this.renderer.listen(this.resizeHandle, 'pointerdown', (event: PointerEvent) =>
      this.onPointerDown(event, this.resizeHandle!),
    );
    this.renderer.appendChild(this.el.nativeElement, this.resizeHandle);

    this.addLinkTitles();

    this.destroyRef.onDestroy(() => {
      this.stopDragging();
    });
  }

  private toggleCollapsed(): void {
    this.applyCollapsedState(!this.collapsed);
    localStorage.setItem(COLLAPSED_STORAGE_KEY, String(this.collapsed));

    if (!this.collapsed) {
      this.applyWidth(this.readSavedWidth());
    }
  }

  private applyCollapsedState(collapsed: boolean): void {
    this.collapsed = collapsed;

    if (collapsed) {
      this.stopDragging();
      this.applyWidth(COLLAPSED_WIDTH);
      this.renderer.addClass(this.el.nativeElement, 'page-layout__sidebar--collapsed');
      if (this.pageSidebar) {
        this.renderer.addClass(this.pageSidebar, 'page-sidebar--collapsed');
      }
    } else {
      this.renderer.removeClass(this.el.nativeElement, 'page-layout__sidebar--collapsed');
      if (this.pageSidebar) {
        this.renderer.removeClass(this.pageSidebar, 'page-sidebar--collapsed');
      }
    }

    if (this.foldButton) {
      this.renderer.setAttribute(this.foldButton, 'aria-label', this.foldAriaLabel());
      this.renderer.setAttribute(
        this.foldButton,
        'aria-expanded',
        String(!this.collapsed),
      );
      this.updateFoldIcon();
    }
  }

  private updateFoldIcon(): void {
    if (!this.foldButton) {
      return;
    }

    this.foldButton.textContent = '';
    const icon = this.renderer.createElement('span');
    this.renderer.addClass(icon, 'mat-icon');
    this.renderer.addClass(icon, 'material-icons');
    this.renderer.addClass(icon, 'notranslate');
    this.renderer.setAttribute(icon, 'aria-hidden', 'true');
    this.renderer.appendChild(
      icon,
      this.renderer.createText(this.collapsed ? 'chevron_right' : 'chevron_left'),
    );
    this.renderer.appendChild(this.foldButton, icon);
  }

  private foldAriaLabel(): string {
    return this.collapsed ? 'Expand browse sidebar' : 'Collapse browse sidebar';
  }

  private addLinkTitles(): void {
    const root = this.pageSidebar ?? this.el.nativeElement;
    const links = root.querySelectorAll('.page-sidebar__link');
    for (const link of links) {
      const element = link as HTMLElement;
      if (element.getAttribute('title')) {
        continue;
      }

      const label = element.textContent?.replace(/\s+/g, ' ').trim();
      if (label) {
        this.renderer.setAttribute(element, 'title', label);
      }
    }
  }

  private onPointerDown(event: PointerEvent, handle: HTMLElement): void {
    if (this.collapsed) {
      return;
    }

    event.preventDefault();
    this.isDragging = true;
    this.startX = event.clientX;
    this.startWidth = this.el.nativeElement.getBoundingClientRect().width;

    handle.setPointerCapture(event.pointerId);
    this.renderer.addClass(this.el.nativeElement, 'page-layout__sidebar--resizing');
    this.renderer.addClass(document.body, 'page-layout--sidebar-resizing');

    this.unlistenMove = this.renderer.listen('document', 'pointermove', (e: PointerEvent) =>
      this.onPointerMove(e),
    );
    this.unlistenUp = this.renderer.listen('document', 'pointerup', (e: PointerEvent) =>
      this.onPointerUp(e, handle),
    );
  }

  private onPointerMove(event: PointerEvent): void {
    if (!this.isDragging || this.collapsed) {
      return;
    }

    const width = this.clamp(this.startWidth + (event.clientX - this.startX));
    this.applyWidth(width);
  }

  private onPointerUp(event: PointerEvent, handle: HTMLElement): void {
    if (!this.isDragging) {
      return;
    }

    handle.releasePointerCapture(event.pointerId);
    this.stopDragging();

    const width = Math.round(this.el.nativeElement.getBoundingClientRect().width);
    localStorage.setItem(WIDTH_STORAGE_KEY, String(width));
  }

  private stopDragging(): void {
    this.isDragging = false;
    this.renderer.removeClass(this.el.nativeElement, 'page-layout__sidebar--resizing');
    this.renderer.removeClass(document.body, 'page-layout--sidebar-resizing');
    this.unlistenMove?.();
    this.unlistenUp?.();
    this.unlistenMove = undefined;
    this.unlistenUp = undefined;
  }

  private applyWidth(width: number): void {
    this.renderer.setStyle(this.el.nativeElement, 'width', `${width}px`);
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

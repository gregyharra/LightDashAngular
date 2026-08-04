import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  input,
  viewChild,
} from '@angular/core';
import { ECharts, EChartsOption, init } from 'echarts';

@Component({
  selector: 'app-echart-host',
  standalone: true,
  template: `
    <div
      #container
      class="echart-host"
      role="img"
      [attr.aria-label]="ariaLabel()"
    ></div>
  `,
  styleUrl: './echart-host.component.scss',
})
export class EchartHostComponent implements AfterViewInit, OnDestroy {
  readonly option = input<EChartsOption | null>(null);
  readonly ariaLabel = input('Chart visualization');

  private readonly container =
    viewChild<ElementRef<HTMLDivElement>>('container');
  private chart: ECharts | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private viewReady = false;

  constructor() {
    effect(() => {
      const option = this.option();
      if (this.viewReady) {
        this.render(option);
      }
    });
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.render(this.option());

    const container = this.container()?.nativeElement;
    if (container && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.chart?.resize());
      this.resizeObserver.observe(container);
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.disposeChart();
  }

  private render(option: EChartsOption | null): void {
    if (!option) {
      this.disposeChart();
      return;
    }

    const container = this.container()?.nativeElement;
    if (!container) {
      return;
    }

    try {
      this.chart ??= init(container);
      this.chart.setOption(option, { notMerge: true });
    } catch {
      this.disposeChart();
    }
  }

  private disposeChart(): void {
    const container = this.container()?.nativeElement;
    this.chart?.dispose();
    this.chart = null;
    container?.replaceChildren();
  }
}

import { Injectable, Signal, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { ChartQueryActions } from './chart-query.actions';
import {
  ChartQueryEntry,
  ChartQueryKeyInput,
} from './chart-query.models';
import { selectEntries } from './chart-query.selectors';

@Injectable({ providedIn: 'root' })
export class ChartQueryFacade {
  private readonly store = inject(Store);

  readonly entries: Signal<Record<string, ChartQueryEntry>> = toSignal(
    this.store.select(selectEntries),
    { initialValue: {} },
  );

  load(key: string, input: ChartQueryKeyInput): void {
    this.store.dispatch(ChartQueryActions.load({ key, input }));
  }

  invalidate(key: string): void {
    this.store.dispatch(ChartQueryActions.invalidate({ key }));
  }

  invalidateAll(): void {
    this.store.dispatch(ChartQueryActions.invalidateAll());
  }
}

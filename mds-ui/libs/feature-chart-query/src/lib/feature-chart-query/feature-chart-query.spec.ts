import { TestBed } from '@angular/core/testing';
import { Store } from '@ngrx/store';
import { BehaviorSubject } from 'rxjs';
import { ChartQueryFacade } from './chart-query.facade';
import { ChartQueryActions } from './chart-query.actions';
import { ChartQueryEntry } from './chart-query.models';

describe('ChartQueryFacade', () => {
  let entries$: BehaviorSubject<Record<string, ChartQueryEntry>>;
  let dispatch: jest.Mock;
  let facade: ChartQueryFacade;

  beforeEach(() => {
    entries$ = new BehaviorSubject({});
    dispatch = jest.fn();

    TestBed.configureTestingModule({
      providers: [
        ChartQueryFacade,
        {
          provide: Store,
          useValue: {
            select: () => entries$.asObservable(),
            dispatch,
          },
        },
      ],
    });
    facade = TestBed.inject(ChartQueryFacade);
  });

  it('exposes chart-query entries as a signal', () => {
    const entry: ChartQueryEntry = { status: 'loading' };

    entries$.next({ query: entry });

    expect(facade.entries()).toEqual({ query: entry });
  });

  it('dispatches load requests', () => {
    const input = {
      kind: 'savedChartView' as const,
      projectUuid: 'project',
      savedChartUuid: 'chart',
      dimensionFilters: [],
    };

    facade.load('key', input);

    expect(dispatch).toHaveBeenCalledWith(
      ChartQueryActions.load({ key: 'key', input }),
    );
  });

  it('invalidates one or all cached queries', () => {
    facade.invalidate('key');
    facade.invalidateAll();

    expect(dispatch).toHaveBeenNthCalledWith(
      1,
      ChartQueryActions.invalidate({ key: 'key' }),
    );
    expect(dispatch).toHaveBeenNthCalledWith(
      2,
      ChartQueryActions.invalidateAll(),
    );
  });
});

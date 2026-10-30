import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { TranslateService } from '@ngx-translate/core';
import { catchError, concatMap, map, of } from 'rxjs';
import { ChartQueryActions } from './chart-query.actions';
import {
  ChartQueryLoader,
  chartQueryErrorMessage,
} from './chart-query.loader';

@Injectable()
export class ChartQueryEffects {
  private readonly actions$ = inject(Actions);
  private readonly loader = inject(ChartQueryLoader);
  private readonly translate = inject(TranslateService);

  readonly load$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ChartQueryActions.load),
      concatMap((action) =>
        this.loader.load(action.input).pipe(
          map((snapshot) =>
            ChartQueryActions.loadSuccess({
              key: action.key,
              snapshot,
            }),
          ),
          catchError((error) =>
            of(
              ChartQueryActions.loadFailure({
                key: action.key,
                error: chartQueryErrorMessage(
                  error,
                  this.translate.instant('charts.workspace.loadChartDataError'),
                ),
              }),
            ),
          ),
        ),
      ),
    ),
  );
}

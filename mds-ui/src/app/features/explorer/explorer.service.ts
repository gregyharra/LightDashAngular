import { Injectable, inject } from '@angular/core';
import { Observable, switchMap, throwError, timer } from 'rxjs';
import { map } from 'rxjs/operators';
import { LightdashApiService, toApiError } from '../../core/api/lightdash-api.service';
import {
  AsyncQueryPollResponse,
  ExecuteAsyncMetricQueryResponse,
  Explore,
  ExploreSummary,
  ExploresMap,
  MetricQuery,
  QueryResults,
} from '../../core/models/explore.model';

@Injectable({ providedIn: 'root' })
export class ExplorerService {
  private readonly api = inject(LightdashApiService);

  listExplores(projectUuid: string): Observable<ExploreSummary[]> {
    return this.api
      .get<ExploresMap>(`/projects/${projectUuid}/explores`)
      .pipe(map((explores) => Object.values(explores)));
  }

  getExplore(projectUuid: string, tableId: string): Observable<Explore> {
    return this.api.get<Explore>(
      `/projects/${projectUuid}/explores/${tableId}`,
    );
  }

  runQuery(projectUuid: string, metricQuery: MetricQuery): Observable<QueryResults> {
    return this.api
      .post<ExecuteAsyncMetricQueryResponse>(
        `/projects/${projectUuid}/query/metric-query`,
        { query: metricQuery },
        { apiVersion: 'v2' },
      )
      .pipe(
        switchMap((response) =>
          this.pollQueryResults(projectUuid, response).pipe(
            map((poll) => ({
              queryUuid: response.queryUuid,
              metricQuery: response.metricQuery,
              rows: poll.rows,
              fields: response.fields,
              cacheMetadata: response.cacheMetadata,
              warnings: poll.warnings ?? response.warnings ?? [],
              compiledSql: poll.compiledSql ?? response.compiledSql ?? null,
            })),
          ),
        ),
      );
  }

  private pollQueryResults(
    projectUuid: string,
    response: ExecuteAsyncMetricQueryResponse,
    backoffMs = 100,
  ): Observable<Extract<AsyncQueryPollResponse, { status: 'ready' }>> {
    return this.api
      .get<AsyncQueryPollResponse>(
        `/projects/${projectUuid}/query/${response.queryUuid}`,
        { apiVersion: 'v2' },
      )
      .pipe(
        switchMap((poll) => {
          if (poll.status === 'ready') {
            return new Observable<
              Extract<AsyncQueryPollResponse, { status: 'ready' }>
            >((subscriber) => {
              subscriber.next(poll);
              subscriber.complete();
            });
          }

          if (
            poll.status === 'error' ||
            poll.status === 'expired'
          ) {
            return throwError(() =>
              toApiError({
                status: 'error',
                error: {
                  name: 'QueryError',
                  statusCode: 400,
                  message: poll.error ?? 'Query failed',
                },
              }),
            );
          }

          const nextBackoff = Math.min(backoffMs * 2, 1000);
          return timer(backoffMs).pipe(
            switchMap(() =>
              this.pollQueryResults(projectUuid, response, nextBackoff),
            ),
          );
        }),
      );
  }
}

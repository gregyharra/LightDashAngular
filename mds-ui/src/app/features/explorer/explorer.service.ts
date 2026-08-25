import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Observable, shareReplay, switchMap, tap, throwError, timer } from 'rxjs';
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

export type RunQueryOptions = {
  bypassCache?: boolean;
};

@Injectable({ providedIn: 'root' })
export class ExplorerService {
  private readonly api = inject(LightdashApiService);
  private readonly translate = inject(TranslateService);
  private readonly exploreCache = new Map<string, Observable<Explore>>();
  private readonly queryCache = new Map<string, Observable<QueryResults>>();

  listExplores(projectUuid: string): Observable<ExploreSummary[]> {
    return this.api
      .get<ExploresMap>(`/projects/${projectUuid}/explores`)
      .pipe(map((explores) => Object.values(explores)));
  }

  getExplore(projectUuid: string, tableId: string): Observable<Explore> {
    const key = `${projectUuid}:${tableId}`;
    const cached = this.exploreCache.get(key);
    if (cached) {
      return cached;
    }

    const request$ = this.api
      .get<Explore>(`/projects/${projectUuid}/explores/${tableId}`)
      .pipe(
        tap({ error: () => this.exploreCache.delete(key) }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    this.exploreCache.set(key, request$);
    return request$;
  }

  runQuery(
    projectUuid: string,
    metricQuery: MetricQuery,
    options?: RunQueryOptions,
  ): Observable<QueryResults> {
    const key = JSON.stringify({ projectUuid, metricQuery });
    if (!options?.bypassCache) {
      const cached = this.queryCache.get(key);
      if (cached) {
        return cached;
      }
    }

    const request$ = this.api
      .post<ExecuteAsyncMetricQueryResponse>(
        `/projects/${projectUuid}/query/metric-query`,
        {
          query: metricQuery,
          ...(options?.bypassCache ? { bypassCache: true } : {}),
        },
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
        tap({ error: () => this.queryCache.delete(key) }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    this.queryCache.set(key, request$);
    return request$;
  }

  private pollQueryResults(
    projectUuid: string,
    response: ExecuteAsyncMetricQueryResponse,
    backoffMs = 50,
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
                  message:
                    poll.error ?? this.translate.instant('common.queryFailed'),
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

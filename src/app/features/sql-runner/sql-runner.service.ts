import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, switchMap, throwError, timer } from 'rxjs';
import { map } from 'rxjs/operators';
import { LightdashApiService } from '../../core/api/lightdash-api.service';
import {
  ExecuteAsyncSqlQueryResponse,
  SqlQueryPollResponse,
  SqlRunnerBody,
  SqlRunnerColumn,
  SqlRunnerResults,
  WarehouseTableSchema,
  WarehouseTablesCatalog,
} from '../../core/models/sql-runner.model';

const DEFAULT_SQL_LIMIT = 500;
const INITIAL_POLL_BACKOFF_MS = 250;
const MAX_POLL_BACKOFF_MS = 1000;

function parseResultsStream(text: string): Record<string, unknown>[] {
  return text
    .trim()
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

function normalizePollColumns(
  columns: SqlRunnerColumn[] | Record<string, SqlRunnerColumn>,
): SqlRunnerColumn[] {
  if (Array.isArray(columns)) {
    return columns;
  }

  return Object.values(columns);
}

@Injectable({ providedIn: 'root' })
export class SqlRunnerService {
  private readonly api = inject(LightdashApiService);
  private readonly http = inject(HttpClient);

  getTables(projectUuid: string): Observable<WarehouseTablesCatalog> {
    return this.api.get<WarehouseTablesCatalog>(
      `/projects/${projectUuid}/sqlRunner/tables`,
    );
  }

  getTableFields(
    projectUuid: string,
    tableName: string,
    schemaName: string,
    databaseName?: string,
  ): Observable<WarehouseTableSchema> {
    return this.api.get<WarehouseTableSchema>(
      `/projects/${projectUuid}/sqlRunner/fields`,
      {
        params: {
          tableName,
          schemaName,
          ...(databaseName ? { databaseName } : {}),
        },
      },
    );
  }

  runQuery(
    projectUuid: string,
    body: SqlRunnerBody,
  ): Observable<SqlRunnerResults> {
    const payload: SqlRunnerBody = {
      sql: body.sql,
      limit: body.limit ?? DEFAULT_SQL_LIMIT,
      parameters: body.parameters,
      invalidateCache: body.invalidateCache ?? true,
    };

    return this.api
      .post<ExecuteAsyncSqlQueryResponse>(
        `/projects/${projectUuid}/query/sql`,
        payload,
        { apiVersion: 'v2' },
      )
      .pipe(
        switchMap((response) =>
          this.pollQueryResults(projectUuid, response.queryUuid).pipe(
            switchMap((poll) =>
              this.fetchResultsFromStream(projectUuid, response.queryUuid).pipe(
                map((rows) => ({
                  queryUuid: response.queryUuid,
                  columns: normalizePollColumns(poll.columns),
                  rows,
                  totalResults: poll.totalResults,
                })),
              ),
            ),
          ),
        ),
      );
  }

  private fetchResultsFromStream(
    projectUuid: string,
    queryUuid: string,
  ): Observable<Record<string, unknown>[]> {
    return this.http
      .get(`/api/v2/projects/${projectUuid}/query/${queryUuid}/results`, {
        responseType: 'text',
        withCredentials: true,
      })
      .pipe(map((text) => parseResultsStream(text)));
  }

  private pollQueryResults(
    projectUuid: string,
    queryUuid: string,
    backoffMs = INITIAL_POLL_BACKOFF_MS,
  ): Observable<Extract<SqlQueryPollResponse, { status: 'ready' }>> {
    return this.api
      .get<SqlQueryPollResponse>(
        `/projects/${projectUuid}/query/${queryUuid}`,
        { apiVersion: 'v2' },
      )
      .pipe(
        switchMap((poll) => {
          if (poll.status === 'ready') {
            return new Observable<
              Extract<SqlQueryPollResponse, { status: 'ready' }>
            >((subscriber) => {
              subscriber.next(poll);
              subscriber.complete();
            });
          }

          if (poll.status === 'error' || poll.status === 'expired') {
            return throwError(
              () => new Error(poll.error ?? 'SQL query failed'),
            );
          }

          const nextBackoff = Math.min(backoffMs * 2, MAX_POLL_BACKOFF_MS);
          return timer(backoffMs).pipe(
            switchMap(() =>
              this.pollQueryResults(projectUuid, queryUuid, nextBackoff),
            ),
          );
        }),
      );
  }
}

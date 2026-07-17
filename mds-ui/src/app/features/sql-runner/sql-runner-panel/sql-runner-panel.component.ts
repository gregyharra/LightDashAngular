import {
  Component,
  computed,
  HostListener,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { apiErrorMessage } from '../../../core/api/lightdash-api.service';
import {
  PartitionColumn,
  SqlRunnerColumn,
  WarehouseSchemaEntry,
  WarehouseTableField,
  WarehouseTablesCatalog,
} from '../../../core/models/sql-runner.model';
import { defaultSampleSql } from '../../../core/mock/fixtures/sql-runner.fixture';
import { AppStateService } from '../../../core/services/app-state.service';
import { SqlRunnerService } from '../sql-runner.service';

const DEFAULT_SQL_LIMIT = 500;
const DEFAULT_QUOTE_CHAR = '"';

function flattenWarehouseCatalog(
  catalog: WarehouseTablesCatalog,
): WarehouseSchemaEntry[] {
  return Object.entries(catalog).flatMap(([database, schemas]) =>
    Object.entries(schemas).map(([schema, tables]) => ({
      database,
      schema,
      tables: Object.keys(tables),
    })),
  );
}

function quoteIdentifier(identifier: string, quoteChar = DEFAULT_QUOTE_CHAR): string {
  return `${quoteChar}${identifier}${quoteChar}`;
}

function buildQuotedTableName(
  database: string,
  schema: string,
  table: string,
  quoteChar = DEFAULT_QUOTE_CHAR,
): string {
  return [
    quoteIdentifier(database, quoteChar),
    quoteIdentifier(schema, quoteChar),
    quoteIdentifier(table, quoteChar),
  ].join('.');
}

function partitionFilter(partitionColumn: PartitionColumn | undefined): string {
  if (!partitionColumn) {
    return '';
  }

  const hint =
    partitionColumn.partitionType === 'DATE'
      ? 'This table has a date partition on this field'
      : 'This table has a range partition on this field';

  const defaultValue =
    partitionColumn.partitionType === 'DATE'
      ? `'${new Date().toISOString().slice(0, 10)}'`
      : '0';

  return `\nWHERE ${partitionColumn.field} = ${defaultValue} -- ${hint}`;
}

@Component({
  selector: 'app-sql-runner-panel',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTableModule,
  ],
  templateUrl: './sql-runner-panel.component.html',
  styleUrl: './sql-runner-panel.component.scss',
})
export class SqlRunnerPanelComponent implements OnInit {
  private readonly sqlRunnerService = inject(SqlRunnerService);
  private readonly appState = inject(AppStateService);

  readonly projectUuid = input.required<string>();
  readonly initialSql = input<string>(defaultSampleSql);

  protected readonly sql = signal('');
  protected readonly limit = signal(DEFAULT_SQL_LIMIT);
  protected readonly running = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly columns = signal<SqlRunnerColumn[]>([]);
  protected readonly rows = signal<Record<string, unknown>[]>([]);
  protected readonly totalResults = signal(0);
  protected readonly hasRun = signal(false);

  protected readonly catalog = signal<WarehouseTablesCatalog>({});
  protected readonly schemaEntries = signal<WarehouseSchemaEntry[]>([]);
  protected readonly selectedSchemaKey = signal<string | null>(null);
  protected readonly catalogLoading = signal(true);

  protected readonly activeTable = signal<string | null>(null);
  protected readonly activeSchema = signal<string | null>(null);
  protected readonly activeDatabase = signal<string | null>(null);
  protected readonly tableFields = signal<WarehouseTableField[]>([]);
  protected readonly tableFieldsLoading = signal(false);

  protected readonly displayedColumns = computed(() =>
    this.columns().map((column) => column.reference),
  );

  protected readonly selectedSchemaEntry = computed(() => {
    const key = this.selectedSchemaKey();
    return this.schemaEntries().find((entry) => `${entry.database}.${entry.schema}` === key) ?? null;
  });

  protected readonly defaultLimit = computed(
    () => this.appState.health()?.query?.defaultLimit ?? DEFAULT_SQL_LIMIT,
  );

  protected readonly maxLimit = computed(
    () => this.appState.health()?.query?.maxLimit ?? 5000,
  );

  protected readonly showLimitMessage = computed(() => {
    const limit = this.limit();
    return this.hasRun() && !this.running() && !this.error() && this.rows().length >= limit;
  });

  constructor() {
    this.sql.set(this.initialSql());
  }

  ngOnInit(): void {
    const defaultLimit = this.defaultLimit();
    this.limit.set(defaultLimit);
    this.loadCatalog();
  }

  @HostListener('document:keydown', ['$event'])
  protected onDocumentKeydown(event: KeyboardEvent): void {
    const isRunShortcut =
      event.key === 'Enter' && (event.metaKey || event.ctrlKey);

    if (!isRunShortcut || this.running()) {
      return;
    }

    const target = event.target;
    if (
      target instanceof HTMLElement &&
      !target.closest('.sql-runner__editor')
    ) {
      return;
    }

    event.preventDefault();
    this.runQuery();
  }

  private loadCatalog(): void {
    const projectUuid = this.projectUuid();
    this.catalogLoading.set(true);

    this.sqlRunnerService.getTables(projectUuid).subscribe({
      next: (catalog) => {
        this.catalog.set(catalog);
        const entries = flattenWarehouseCatalog(catalog);
        this.schemaEntries.set(entries);
        const firstEntry = entries[0];
        this.selectedSchemaKey.set(
          firstEntry ? `${firstEntry.database}.${firstEntry.schema}` : null,
        );
        this.catalogLoading.set(false);
      },
      error: () => {
        this.catalogLoading.set(false);
      },
    });
  }

  protected onSchemaChange(schemaKey: string): void {
    this.selectedSchemaKey.set(schemaKey);
    this.activeTable.set(null);
    this.activeSchema.set(null);
    this.activeDatabase.set(null);
    this.tableFields.set([]);
  }

  protected selectTable(tableName: string): void {
    const entry = this.selectedSchemaEntry();
    if (!entry) {
      return;
    }

    const quotedTable = buildQuotedTableName(
      entry.database,
      entry.schema,
      tableName,
    );
    const partitionColumn =
      this.catalog()[entry.database]?.[entry.schema]?.[tableName]?.partitionColumn;
    const currentSql = this.sql().trim();

    if (!currentSql || /^SELECT \* FROM .+/i.test(currentSql)) {
      this.sql.set(`SELECT * FROM ${quotedTable}${partitionFilter(partitionColumn)}`);
    }

    const isSameTable =
      this.activeTable() === tableName &&
      this.activeSchema() === entry.schema &&
      this.activeDatabase() === entry.database;

    if (isSameTable) {
      this.activeTable.set(null);
      this.activeSchema.set(null);
      this.activeDatabase.set(null);
      this.tableFields.set([]);
      return;
    }

    this.activeTable.set(tableName);
    this.activeSchema.set(entry.schema);
    this.activeDatabase.set(entry.database);
    this.loadTableFields(tableName, entry.schema, entry.database);
  }

  protected isTableActive(tableName: string): boolean {
    const entry = this.selectedSchemaEntry();
    return (
      this.activeTable() === tableName &&
      this.activeSchema() === entry?.schema &&
      this.activeDatabase() === entry?.database
    );
  }

  private loadTableFields(
    tableName: string,
    schemaName: string,
    databaseName: string,
  ): void {
    const projectUuid = this.projectUuid();
    this.tableFieldsLoading.set(true);

    this.sqlRunnerService
      .getTableFields(projectUuid, tableName, schemaName, databaseName)
      .subscribe({
        next: (fields) => {
          this.tableFields.set(
            Object.entries(fields).map(([name, type]) => ({ name, type })),
          );
          this.tableFieldsLoading.set(false);
        },
        error: () => {
          this.tableFields.set([]);
          this.tableFieldsLoading.set(false);
        },
      });
  }

  protected runQuery(): void {
    const projectUuid = this.projectUuid();
    const sql = this.sql().trim();

    if (!sql) {
      this.error.set('Enter a SQL query to run.');
      return;
    }

    this.running.set(true);
    this.error.set(null);
    this.hasRun.set(true);

    this.sqlRunnerService
      .runQuery(projectUuid, {
        sql,
        limit: this.limit(),
        invalidateCache: true,
      })
      .subscribe({
        next: (results) => {
          this.columns.set(results.columns);
          this.rows.set(results.rows);
          this.totalResults.set(results.totalResults);
          this.running.set(false);
        },
        error: (err) => {
          this.error.set(apiErrorMessage(err));
          this.columns.set([]);
          this.rows.set([]);
          this.totalResults.set(0);
          this.running.set(false);
        },
      });
  }
}

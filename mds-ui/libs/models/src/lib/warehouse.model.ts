export const WAREHOUSE_TYPE_OPTIONS = [
  { value: 'trino', label: 'Trino', defaultPort: 8080 },
  { value: 'postgresql', label: 'PostgreSQL', defaultPort: 5432 },
  { value: 'oracle', label: 'Oracle', defaultPort: 1521 },
  { value: 'snowflake', label: 'Snowflake', defaultPort: 443 },
  { value: 'bigquery', label: 'BigQuery', defaultPort: 443 },
] as const;

export type WarehouseType = (typeof WAREHOUSE_TYPE_OPTIONS)[number]['value'];

export const WAREHOUSE_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  WAREHOUSE_TYPE_OPTIONS.map(({ value, label }) => [value, label]),
);

export function defaultPortForWarehouseType(type: string): number {
  return WAREHOUSE_TYPE_OPTIONS.find((option) => option.value === type)?.defaultPort ?? 8080;
}

export interface Warehouse {
  warehouseUuid: string;
  name: string;
  type: string;
  host: string;
  port: number;
  catalog: string;
  schema: string;
  user: string;
  hasPassword: boolean;
  ssl: boolean;
  extraConfig: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface WarehouseListItem {
  warehouseUuid: string;
  name: string;
  type: string;
  host: string;
  port: number;
  catalog: string;
  schema: string;
  hasPassword: boolean;
  updatedAt: string;
}

export interface WarehouseCreate {
  name: string;
  type: string;
  host: string;
  port: number;
  catalog?: string;
  schema?: string;
  user: string;
  password?: string;
  ssl: boolean;
  extraConfig?: Record<string, unknown>;
}

export interface WarehouseUpdate {
  name?: string;
  type?: string;
  host?: string;
  port?: number;
  catalog?: string;
  schema?: string;
  user?: string;
  password?: string;
  clearPassword?: boolean;
  ssl?: boolean;
  extraConfig?: Record<string, unknown>;
}

export interface WarehouseTestResult {
  success: boolean;
  message: string;
}

export interface WarehouseTestConnection {
  type: string;
  host: string;
  port: number;
  user: string;
  password?: string;
  catalog?: string;
  schema?: string;
  ssl: boolean;
  warehouseUuid?: string;
}

export interface WarehouseConnection {
  projectUuid: string;
  type: string;
  host: string;
  port: number;
  catalog: string;
  schema: string;
  user: string;
  hasPassword: boolean;
  ssl: boolean;
  extraConfig: Record<string, unknown>;
  configured: boolean;
}

export interface WarehouseConnectionUpsert {
  type: string;
  host: string;
  port: number;
  catalog: string;
  schema: string;
  user: string;
  password?: string;
  clearPassword?: boolean;
  ssl: boolean;
  extraConfig?: Record<string, unknown>;
}

export interface WarehouseConnectionTestResult {
  success: boolean;
  message: string;
}

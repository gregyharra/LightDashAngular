export interface Warehouse {
  warehouseUuid: string;
  organizationUuid: string;
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
  catalog: string;
  schema: string;
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

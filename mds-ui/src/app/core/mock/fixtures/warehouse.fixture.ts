import {
  Warehouse,
  WarehouseCreate,
  WarehouseListItem,
  WarehouseUpdate,
} from '../../models/warehouse.model';

const warehouses = new Map<string, { warehouse: Warehouse; password?: string }>();

function newUuid(): string {
  return crypto.randomUUID();
}

function toListItem(warehouse: Warehouse): WarehouseListItem {
  return {
    warehouseUuid: warehouse.warehouseUuid,
    name: warehouse.name,
    type: warehouse.type,
    host: warehouse.host,
    port: warehouse.port,
    catalog: warehouse.catalog,
    schema: warehouse.schema,
    hasPassword: warehouse.hasPassword,
    updatedAt: warehouse.updatedAt,
  };
}

export function listMockWarehouses(): WarehouseListItem[] {
  return Array.from(warehouses.values())
    .map(({ warehouse }) => toListItem(warehouse))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getMockWarehouse(warehouseUuid: string): Warehouse | null {
  return warehouses.get(warehouseUuid)?.warehouse ?? null;
}

export function createMockWarehouse(body: WarehouseCreate): Warehouse {
  const now = new Date().toISOString();
  const warehouseUuid = newUuid();
  const warehouse: Warehouse = {
    warehouseUuid,
    organizationUuid: '172a2270-000f-42be-9c68-c4752c23ae51',
    name: body.name,
    type: body.type,
    host: body.host,
    port: body.port,
    catalog: body.catalog ?? '',
    schema: body.schema ?? '',
    user: body.user,
    hasPassword: Boolean(body.password),
    ssl: body.ssl,
    extraConfig: body.extraConfig ?? {},
    createdAt: now,
    updatedAt: now,
  };

  warehouses.set(warehouseUuid, { warehouse, password: body.password });
  return warehouse;
}

export function updateMockWarehouse(
  warehouseUuid: string,
  body: WarehouseUpdate,
): Warehouse | null {
  const stored = warehouses.get(warehouseUuid);
  if (!stored) {
    return null;
  }

  let password = stored.password;
  if (body.clearPassword) {
    password = undefined;
  } else if (body.password) {
    password = body.password;
  }

  const warehouse: Warehouse = {
    ...stored.warehouse,
    name: body.name ?? stored.warehouse.name,
    type: body.type ?? stored.warehouse.type,
    host: body.host ?? stored.warehouse.host,
    port: body.port ?? stored.warehouse.port,
    catalog: body.catalog ?? stored.warehouse.catalog,
    schema: body.schema ?? stored.warehouse.schema,
    user: body.user ?? stored.warehouse.user,
    ssl: body.ssl ?? stored.warehouse.ssl,
    extraConfig: body.extraConfig ?? stored.warehouse.extraConfig,
    hasPassword: Boolean(password),
    updatedAt: new Date().toISOString(),
  };

  warehouses.set(warehouseUuid, { warehouse, password });
  return warehouse;
}

export function deleteMockWarehouse(warehouseUuid: string): boolean {
  return warehouses.delete(warehouseUuid);
}

export function testMockWarehouse(warehouseUuid: string): {
  success: boolean;
  message: string;
} {
  const stored = warehouses.get(warehouseUuid);
  if (!stored) {
    return { success: false, message: 'Warehouse not found' };
  }

  if (stored.warehouse.type !== 'trino') {
    return {
      success: false,
      message: `Connection testing is not yet supported for ${stored.warehouse.type}. Only Trino connections can be tested for now.`,
    };
  }

  return {
    success: true,
    message: 'Mock connection successful (no real Trino server in mock mode)',
  };
}

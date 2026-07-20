import { WarehouseConnection, WarehouseConnectionUpsert } from '../../models/warehouse.model';

const connections = new Map<string, { connection: WarehouseConnection; password?: string }>();

function emptyConnection(projectUuid: string): WarehouseConnection {
  return {
    projectUuid,
    type: 'trino',
    host: '',
    port: 8080,
    catalog: '',
    schema: '',
    user: '',
    hasPassword: false,
    ssl: false,
    extraConfig: {},
    configured: false,
  };
}

export function getMockWarehouseConnection(projectUuid: string): WarehouseConnection {
  return connections.get(projectUuid)?.connection ?? emptyConnection(projectUuid);
}

export function upsertMockWarehouseConnection(
  projectUuid: string,
  body: WarehouseConnectionUpsert,
): WarehouseConnection {
  const existing = connections.get(projectUuid);
  let password = existing?.password;

  if (body.clearPassword) {
    password = undefined;
  } else if (body.password) {
    password = body.password;
  }

  const connection: WarehouseConnection = {
    projectUuid,
    type: body.type,
    host: body.host,
    port: body.port,
    catalog: body.catalog,
    schema: body.schema,
    user: body.user,
    hasPassword: Boolean(password),
    ssl: body.ssl,
    extraConfig: body.extraConfig ?? {},
    configured: true,
  };

  connections.set(projectUuid, { connection, password });
  return connection;
}

export function testMockWarehouseConnection(projectUuid: string): {
  success: boolean;
  message: string;
} {
  const stored = connections.get(projectUuid);
  if (!stored?.connection.configured) {
    return { success: false, message: 'Warehouse connection is not configured' };
  }

  return {
    success: true,
    message: 'Mock connection successful (no real Trino server in mock mode)',
  };
}

import { Explore, getFieldId } from '../../models/explore.model';
import {
  buildExploreFromLineageNode,
  resolveLineageNodeForExploreRequest,
} from '../../../features/explorer/explore-from-dbt.utils';
import { fctOrdersExplore } from './explore-fct-orders.fixture';
import { mockLineage } from './lineage.fixture';

const ordersTable = {
  name: 'orders',
  label: 'Orders',
  database: 'jaffle_shop',
  schema: 'marts',
  sqlTable: 'marts.fct_orders',
  description: 'Order-level fact table enriched with customer context',
  dimensions: {
    order_id: {
      fieldType: 'dimension' as const,
      type: 'number' as const,
      name: 'order_id',
      label: 'Order ID',
      table: 'orders',
      tableLabel: 'Orders',
      sql: '${TABLE}.order_id',
      hidden: false,
      description: 'Unique order identifier',
    },
    status: {
      fieldType: 'dimension' as const,
      type: 'string' as const,
      name: 'status',
      label: 'Status',
      table: 'orders',
      tableLabel: 'Orders',
      sql: '${TABLE}.status',
      hidden: false,
      description: 'Order fulfillment status',
    },
    order_date: {
      fieldType: 'dimension' as const,
      type: 'date' as const,
      name: 'order_date',
      label: 'Order date',
      table: 'orders',
      tableLabel: 'Orders',
      sql: '${TABLE}.order_date',
      hidden: false,
      description: 'Date the order was placed',
    },
    customer_id: {
      fieldType: 'dimension' as const,
      type: 'number' as const,
      name: 'customer_id',
      label: 'Customer ID',
      table: 'orders',
      tableLabel: 'Orders',
      sql: '${TABLE}.customer_id',
      hidden: false,
      description: 'Foreign key to customers',
    },
    store_id: {
      fieldType: 'dimension' as const,
      type: 'number' as const,
      name: 'store_id',
      label: 'Store ID',
      table: 'orders',
      tableLabel: 'Orders',
      sql: '${TABLE}.store_id',
      hidden: false,
    },
    amount: {
      fieldType: 'dimension' as const,
      type: 'number' as const,
      name: 'amount',
      label: 'Order amount',
      table: 'orders',
      tableLabel: 'Orders',
      sql: '${TABLE}.amount',
      hidden: false,
      description: 'Total order amount in USD',
    },
  },
  metrics: {
    order_count: {
      fieldType: 'metric' as const,
      type: 'count' as const,
      name: 'order_count',
      label: 'Order count',
      table: 'orders',
      tableLabel: 'Orders',
      sql: '${TABLE}.order_id',
      hidden: false,
      description: 'Count of distinct orders',
    },
    total_revenue: {
      fieldType: 'metric' as const,
      type: 'sum' as const,
      name: 'total_revenue',
      label: 'Total revenue',
      table: 'orders',
      tableLabel: 'Orders',
      sql: '${TABLE}.amount',
      hidden: false,
      description: 'Sum of order amounts',
    },
    average_order_value: {
      fieldType: 'metric' as const,
      type: 'average' as const,
      name: 'average_order_value',
      label: 'Average order value',
      table: 'orders',
      tableLabel: 'Orders',
      sql: '${TABLE}.amount',
      hidden: false,
      description: 'Average amount per order',
    },
  },
};

const customersTable = {
  name: 'customers',
  label: 'Customers',
  database: 'jaffle_shop',
  schema: 'marts',
  sqlTable: 'marts.dim_customers',
  description: 'Customer dimension',
  dimensions: {
    first_name: {
      fieldType: 'dimension' as const,
      type: 'string' as const,
      name: 'first_name',
      label: 'First name',
      table: 'customers',
      tableLabel: 'Customers',
      sql: '${TABLE}.first_name',
      hidden: false,
    },
    last_name: {
      fieldType: 'dimension' as const,
      type: 'string' as const,
      name: 'last_name',
      label: 'Last name',
      table: 'customers',
      tableLabel: 'Customers',
      sql: '${TABLE}.last_name',
      hidden: false,
    },
    email: {
      fieldType: 'dimension' as const,
      type: 'string' as const,
      name: 'email',
      label: 'Email',
      table: 'customers',
      tableLabel: 'Customers',
      sql: '${TABLE}.email',
      hidden: false,
    },
  },
  metrics: {
    customer_count: {
      fieldType: 'metric' as const,
      type: 'count' as const,
      name: 'customer_count',
      label: 'Customer count',
      table: 'customers',
      tableLabel: 'Customers',
      sql: '${TABLE}.customer_id',
      hidden: false,
    },
  },
};

export const ordersExplore: Explore = {
  name: 'orders',
  label: 'Orders',
  tags: ['ecommerce', 'fact'],
  description: 'Order-level metrics with customer context from Jaffle Shop',
  baseTable: 'orders',
  targetDatabase: 'trino',
  joinedTables: [
    {
      table: 'customers',
      sqlOn: '${orders.customer_id} = ${customers.customer_id}',
      type: 'left',
      label: 'Customers',
      relationship: 'many-to-one',
    },
  ],
  tables: {
    orders: ordersTable,
    customers: customersTable,
  },
};

function buildMinimalExplore(
  name: string,
  label: string,
  description: string,
  tags: string[],
): Explore {
  return {
    name,
    label,
    tags,
    description,
    baseTable: name,
    targetDatabase: 'trino',
    joinedTables: [],
    tables: {
      [name]: {
        name,
        label,
        database: 'jaffle_shop',
        schema: 'marts',
        sqlTable: `marts.${name}`,
        description,
        dimensions: {
          id: {
            fieldType: 'dimension',
            type: 'number',
            name: 'id',
            label: 'ID',
            table: name,
            tableLabel: label,
            sql: '${TABLE}.id',
            hidden: false,
          },
        },
        metrics: {
          row_count: {
            fieldType: 'metric',
            type: 'count',
            name: 'row_count',
            label: 'Row count',
            table: name,
            tableLabel: label,
            sql: '${TABLE}.id',
            hidden: false,
          },
        },
      },
    },
  };
}

export const mockExploreDetails: Record<string, Explore> = {
  orders: ordersExplore,
  customers: buildMinimalExplore(
    'customers',
    'Users',
    'User accounts and profile information',
    ['ecommerce', 'dimension'],
  ),
  products: buildMinimalExplore(
    'products',
    'Baskets',
    'Basket and product catalog data',
    ['ecommerce', 'dimension'],
  ),
  support_requests: buildMinimalExplore(
    'support_requests',
    'Support requests',
    'Customer support requests and feedback',
    ['support', 'fact'],
  ),
  fct_orders: fctOrdersExplore,
};

export function getExploreDetail(tableId: string): Explore | null {
  const predefined = mockExploreDetails[tableId];
  if (predefined) {
    return predefined;
  }

  const lineageNode = resolveLineageNodeForExploreRequest(
    mockLineage.nodes,
    tableId,
  );
  if (lineageNode) {
    return buildExploreFromLineageNode(lineageNode);
  }

  return null;
}

export function getAllFieldIds(explore: Explore): string[] {
  const ids: string[] = [];
  for (const table of Object.values(explore.tables)) {
    for (const dim of Object.values(table.dimensions)) {
      ids.push(getFieldId(table.name, dim.name));
    }
    for (const metric of Object.values(table.metrics)) {
      ids.push(getFieldId(table.name, metric.name));
    }
  }
  return ids;
}

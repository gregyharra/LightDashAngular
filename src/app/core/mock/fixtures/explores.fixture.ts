import { ExploreSummary } from '../../models/explore.model';

/** Summary explores keyed by explore name (matches LightDash API shape). */
export const mockExplores: Record<string, ExploreSummary> = {
  products: {
    name: 'products',
    label: 'Baskets',
    tags: ['ecommerce', 'dimension'],
    description: 'Basket and product catalog data',
    schemaName: 'marts',
    databaseName: 'jaffle_shop',
  },
  orders: {
    name: 'orders',
    label: 'Orders',
    tags: ['ecommerce', 'fact'],
    description: 'This table contains information on all the confirmed orders and their status',
    schemaName: 'marts',
    databaseName: 'jaffle_shop',
  },
  fct_orders: {
    name: 'fct_orders',
    label: 'Orders (No Pre-Agg)',
    tags: ['fact', 'dbt'],
    description: 'Order fact table without pre-aggregations',
    schemaName: 'marts',
    databaseName: 'jaffle_shop',
  },
  support_requests: {
    name: 'support_requests',
    label: 'Support requests',
    tags: ['support', 'fact'],
    description: 'Customer support requests and feedback',
    schemaName: 'marts',
    databaseName: 'jaffle_shop',
  },
  customers: {
    name: 'customers',
    label: 'Users',
    tags: ['ecommerce', 'dimension'],
    description: 'User accounts and profile information',
    schemaName: 'marts',
    databaseName: 'jaffle_shop',
  },
};

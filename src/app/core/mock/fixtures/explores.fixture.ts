import { ExploreSummary } from '../../models/explore.model';

/** Summary explores keyed by explore name (matches LightDash API shape). */
export const mockExplores: Record<string, ExploreSummary> = {
  orders: {
    name: 'orders',
    label: 'Orders',
    tags: ['ecommerce', 'fact'],
    description: 'Order-level metrics with customer context',
    schemaName: 'marts',
    databaseName: 'jaffle_shop',
  },
  customers: {
    name: 'customers',
    label: 'Customers',
    tags: ['ecommerce', 'dimension'],
    description: 'Customer dimension with lifetime value metrics',
    schemaName: 'marts',
    databaseName: 'jaffle_shop',
  },
  products: {
    name: 'products',
    label: 'Products',
    tags: ['ecommerce', 'dimension'],
    description: 'Product catalog with pricing and supply chain info',
    schemaName: 'marts',
    databaseName: 'jaffle_shop',
  },
  dim_customers: {
    name: 'dim_customers',
    label: 'Dim Customers',
    tags: ['dimension', 'dbt'],
    description: 'Customer dimension table from dbt marts',
    schemaName: 'marts',
    databaseName: 'jaffle_shop',
  },
  fct_orders: {
    name: 'fct_orders',
    label: 'Fct Orders',
    tags: ['fact', 'dbt'],
    description: 'Order fact table enriched with customer attributes',
    schemaName: 'marts',
    databaseName: 'jaffle_shop',
  },
};

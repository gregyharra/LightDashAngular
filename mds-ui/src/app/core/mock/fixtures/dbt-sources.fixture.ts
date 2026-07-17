/** dbt source definitions returned by GET /projects/:uuid/dbt-sources */
export const mockDbtSources = [
  {
    sourceName: 'jaffle_shop',
    schema: 'raw',
    database: 'jaffle_shop',
    tables: [
      {
        name: 'raw_customers',
        description: 'Customer records loaded from the operational Postgres replica',
        tags: ['raw'],
        columns: [
          { name: 'id', description: 'Primary key' },
          { name: 'first_name', description: '' },
          { name: 'last_name', description: '' },
          { name: 'email', description: '' },
          { name: 'created_at', description: '' },
        ],
      },
      {
        name: 'raw_orders',
        description: 'Order headers synced nightly from the POS system',
        tags: ['raw'],
        columns: [
          { name: 'id', description: 'Primary key' },
          { name: 'customer_id', description: 'FK to raw_customers' },
          { name: 'order_date', description: '' },
          { name: 'status', description: '' },
          { name: 'amount', description: '' },
        ],
      },
      {
        name: 'raw_order_items',
        description: 'Line-item details for each order',
        tags: ['raw'],
        columns: [
          { name: 'id', description: 'Primary key' },
          { name: 'order_id', description: 'FK to raw_orders' },
          { name: 'product_id', description: 'FK to raw_products' },
          { name: 'quantity', description: '' },
        ],
      },
      {
        name: 'raw_products',
        description: 'Product catalog with SKU, price, and category',
        tags: ['raw'],
        columns: [
          { name: 'id', description: 'Primary key' },
          { name: 'name', description: '' },
          { name: 'price', description: '' },
          { name: 'category', description: '' },
        ],
      },
      {
        name: 'raw_supplies',
        description: 'Supply inventory and unit costs for COGS calculations',
        tags: ['raw'],
        columns: [
          { name: 'id', description: 'Primary key' },
          { name: 'name', description: '' },
          { name: 'cost', description: '' },
          { name: 'product_id', description: 'FK to raw_products' },
        ],
      },
    ],
  },
];

import { MOCK_PROJECT_UUID } from './ids.fixture';
import { DbtTreeNode, ProjectDbtTree } from '../../models/lineage.model';

function leaf(
  name: string,
  path: string,
  type: DbtTreeNode['type'],
  lineageNodeId: string,
  description?: string,
): DbtTreeNode {
  return { id: path, name, path, type, lineageNodeId, description };
}

function folder(name: string, path: string, children: DbtTreeNode[]): DbtTreeNode {
  return { id: path, name, path, type: 'folder', children };
}

/** Jaffle Shop dbt project tree — mirrors mock/dbt/jaffle_shop layout. */
export const mockDbtProjectTree: ProjectDbtTree = {
  projectUuid: MOCK_PROJECT_UUID,
  projectName: 'Jaffle Shop',
  root: [
    folder('models', 'models', [
      folder('staging', 'models/staging', [
        leaf(
          'stg_customers',
          'models/staging/stg_customers.sql',
          'model',
          'model.jaffle_shop.staging.stg_customers',
          'Cleaned customer records with standardized names and country codes',
        ),
        leaf(
          'stg_orders',
          'models/staging/stg_orders.sql',
          'model',
          'model.jaffle_shop.staging.stg_orders',
          'Typed order records with status normalization and date casting',
        ),
        leaf(
          'stg_order_items',
          'models/staging/stg_order_items.sql',
          'model',
          'model.jaffle_shop.staging.stg_order_items',
          'Line items with quantity validation and product key resolution',
        ),
        leaf(
          'stg_products',
          'models/staging/stg_products.sql',
          'model',
          'model.jaffle_shop.staging.stg_products',
          'Product catalog with price formatting and category cleanup',
        ),
        leaf(
          'stg_supplies',
          'models/staging/stg_supplies.sql',
          'model',
          'model.jaffle_shop.staging.stg_supplies',
          'Supply records with per-unit cost standardization',
        ),
      ]),
      folder('marts', 'models/marts', [
        leaf(
          'dim_customers',
          'models/marts/dim_customers.sql',
          'model',
          'model.jaffle_shop.marts.dim_customers',
          'Customer dimension with lifetime order count and total spend',
        ),
        leaf(
          'dim_products',
          'models/marts/dim_products.sql',
          'model',
          'model.jaffle_shop.marts.dim_products',
          'Product dimension with rolled-up supply cost and margin estimates',
        ),
        leaf(
          'fct_orders',
          'models/marts/fct_orders.sql',
          'model',
          'model.jaffle_shop.marts.fct_orders',
          'Order-level fact table enriched with customer and payment context',
        ),
        leaf(
          'fct_order_items',
          'models/marts/fct_order_items.sql',
          'model',
          'model.jaffle_shop.marts.fct_order_items',
          'Line-item fact table with product details and extended price',
        ),
        leaf(
          'revenue_daily',
          'models/marts/revenue_daily.sql',
          'model',
          'model.jaffle_shop.marts.revenue_daily',
          'Daily revenue, order count, and average order value for executive KPIs',
        ),
        leaf(
          'customer_order_summary',
          'models/marts/customer_order_summary.sql',
          'model',
          'model.jaffle_shop.marts.customer_order_summary',
          'Per-customer order frequency, recency, and monetary value (RFM-style)',
        ),
      ]),
    ]),
    folder('seeds', 'seeds', [
      leaf(
        'country_codes',
        'seeds/country_codes.csv',
        'seed',
        'seed.jaffle_shop.seeds.country_codes',
        'ISO 3166-1 alpha-2 country codes for customer address enrichment',
      ),
      leaf(
        'us_state_abbreviations',
        'seeds/us_state_abbreviations.csv',
        'seed',
        'seed.jaffle_shop.seeds.us_state_abbreviations',
        'US state name to abbreviation lookup table',
      ),
    ]),
    folder('sources', 'sources', [
      {
        id: 'models/sources.yml',
        name: 'sources.yml',
        path: 'models/sources.yml',
        type: 'sources_file',
        description: 'Raw source definitions for the jaffle_shop project',
      },
      folder('raw', 'sources/raw', [
        leaf(
          'raw_customers',
          'sources/raw/raw_customers',
          'source',
          'source.jaffle_shop.raw.raw_customers',
          'Customer records loaded from the operational Postgres replica',
        ),
        leaf(
          'raw_orders',
          'sources/raw/raw_orders',
          'source',
          'source.jaffle_shop.raw.raw_orders',
          'Order headers synced nightly from the POS system',
        ),
        leaf(
          'raw_order_items',
          'sources/raw/raw_order_items',
          'source',
          'source.jaffle_shop.raw.raw_order_items',
          'Line-item details for each order',
        ),
        leaf(
          'raw_products',
          'sources/raw/raw_products',
          'source',
          'source.jaffle_shop.raw.raw_products',
          'Product catalog with SKU, price, and category',
        ),
        leaf(
          'raw_supplies',
          'sources/raw/raw_supplies',
          'source',
          'source.jaffle_shop.raw.raw_supplies',
          'Supply inventory and unit costs for COGS calculations',
        ),
      ]),
    ]),
  ],
};

-- Staging model: product catalog with price formatting

select
    id as product_id,
    trim(name) as product_name,
    cast(price as decimal(10, 2)) as price,
    lower(trim(category)) as category
from {{ source('jaffle_shop', 'raw_products') }}

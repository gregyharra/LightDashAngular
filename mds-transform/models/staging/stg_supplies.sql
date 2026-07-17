-- Staging model: supply records with per-unit cost standardization

select
    id as supply_id,
    trim(name) as supply_name,
    cast(cost as decimal(10, 4)) as unit_cost,
    product_id
from {{ source('jaffle_shop', 'raw_supplies') }}

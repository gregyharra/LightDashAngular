-- Staging model: line items with quantity validation

select
    id as order_item_id,
    order_id,
    product_id,
    quantity
from {{ source('jaffle_shop', 'raw_order_items') }}
where quantity > 0

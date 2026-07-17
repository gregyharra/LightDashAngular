-- Staging model: typed order records with status normalization

select
    id as order_id,
    customer_id,
    cast(order_date as date) as order_date,
    lower(status) as status,
    amount
from {{ source('jaffle_shop', 'raw_orders') }}

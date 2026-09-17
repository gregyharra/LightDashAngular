-- Line-item fact table with product details and extended price

select
    oi.*,
    p.product_name,
    p.price,
    p.category,
    oi.quantity * p.price as extended_price
from {{ ref('stg_order_items') }} oi
inner join {{ ref('dim_products') }} p on oi.product_id = p.product_id

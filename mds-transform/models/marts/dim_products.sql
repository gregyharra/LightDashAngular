-- Product dimension with rolled-up supply cost

select
    p.*,
    coalesce(sum(s.unit_cost), 0) as total_supply_cost
from {{ ref('stg_products') }} p
left join {{ ref('stg_supplies') }} s on p.product_id = s.product_id
group by 1, 2, 3, 4

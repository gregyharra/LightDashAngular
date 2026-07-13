-- Customer dimension with lifetime order metrics

select
    c.*,
    count(o.order_id) as lifetime_order_count,
    coalesce(sum(o.amount), 0) as lifetime_spend
from {{ ref('stg_customers') }} c
left join {{ ref('stg_orders') }} o on c.customer_id = o.customer_id
group by 1, 2, 3, 4, 5

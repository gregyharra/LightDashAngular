-- Per-customer RFM-style order summary

select
    c.customer_id,
    c.first_name,
    c.last_name,
    count(o.order_id) as order_count,
    max(o.order_date) as last_order_date,
    sum(o.amount) as total_spend,
    avg(o.amount) as avg_order_value
from {{ ref('dim_customers') }} c
inner join {{ ref('fct_orders') }} o on c.customer_id = o.customer_id
group by 1, 2, 3

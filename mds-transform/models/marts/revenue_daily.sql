-- Daily revenue aggregates for executive reporting

{{
    config(
        materialized='incremental',
        unique_key='order_date'
    )
}}

select
    order_date,
    count(distinct order_id) as order_count,
    sum(amount) as total_revenue,
    avg(amount) as avg_order_value
from {{ ref('fct_orders') }}
{% if is_incremental() %}
where order_date > (select max(order_date) from {{ this }})
{% endif %}
group by 1

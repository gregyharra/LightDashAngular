-- Order-level fact table enriched with customer context

select
    o.*,
    c.first_name,
    c.last_name,
    c.email
from {{ ref('stg_orders') }} o
inner join {{ ref('dim_customers') }} c on o.customer_id = c.customer_id

-- Staging model: cleaned and typed customer records
-- Depends on: raw_customers, country_codes, us_state_abbreviations

select
    id as customer_id,
    trim(first_name) as first_name,
    trim(last_name) as last_name,
    lower(trim(email)) as email,
    created_at
from {{ source('jaffle_shop', 'raw_customers') }}

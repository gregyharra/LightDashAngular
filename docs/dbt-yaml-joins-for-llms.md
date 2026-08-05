# dbt YAML joins — LLM update guide

Copy this file into a prompt when asking an LLM to add Lightdash-compatible join metadata to a dbt project used by this app (MDS / LightDash Angular).

## Goal

Declare **Explore joins** in dbt YAML so the BI app can show related models as separate field groups and compile SQL `JOIN`s. Joins are **not** inferred from `ref()` or SQL `JOIN`s in models.

## Rules

1. Put joins under the **base** model’s `meta.joins` (or `config.meta.joins`).
2. `join` must match another dbt model/source/seed **`name`** exactly (e.g. `dim_customers`).
3. `sql_on` must use `${model.column}` syntax for both sides.
4. Prefer joins when tables stay separate in the warehouse. If a mart already denormalizes related columns in SQL, either keep the wide table **or** remodel + join — do not double-expose the same attributes without intent.
5. After editing YAML, run `dbt parse` (or `dbt compile`) so `manifest.json` picks up `meta`, then refresh explores in the app.

## YAML shapes

### Preferred (schema.yml)

```yaml
version: 2

models:
  - name: fct_orders
    description: Order facts
    meta:
      primary_key: order_id
      joins:
        - join: dim_customers
          type: left
          sql_on: ${fct_orders.customer_id} = ${dim_customers.customer_id}
          relationship: many-to-one
          label: Customers
          # optional: only expose these fields from the joined model
          # fields: [customer_id, first_name, last_name]
```

### Also supported (`config.meta`)

```yaml
models:
  - name: fct_orders
    config:
      meta:
        joins:
          - join: dim_customers
            sql_on: ${fct_orders.customer_id} = ${dim_customers.customer_id}
```

If both exist, **`config.meta.joins` wins when non-empty**; otherwise top-level `meta.joins` is used.

## Field reference

| Field | Required | Values / notes |
|-------|----------|----------------|
| `join` | yes | Target model/source/seed name |
| `sql_on` | yes | `${base.col} = ${joined.col}` (and/or richer SQL) |
| `type` | no | `left` (default), `inner`, `right`, `full` |
| `label` | no | UI label for the joined table group |
| `relationship` | no | e.g. `many-to-one`, `one-to-many` (stored; fanout not enforced yet) |
| `fields` | no | Whitelist of dimension/metric **names** from the joined table |

## Example for this repo (`mds-transform`)

Suggested starter for orders → customers (only if `dim_customers` is a separate exploreable model and you want its fields as a second group):

**File:** e.g. `models/marts/schema.yml`

```yaml
version: 2

models:
  - name: fct_orders
    meta:
      joins:
        - join: dim_customers
          type: left
          sql_on: ${fct_orders.customer_id} = ${dim_customers.customer_id}
          relationship: many-to-one
          label: Customers

  - name: fct_order_items
    meta:
      joins:
        - join: dim_products
          type: left
          sql_on: ${fct_order_items.product_id} = ${dim_products.product_id}
          relationship: many-to-one
          label: Products
```

Adjust column names to match real columns in each model.

## Checklist for the LLM

- [ ] Identify base explores that need related fields from **other** models.
- [ ] Confirm join keys exist on both models.
- [ ] Add/update `schema.yml` with `meta.joins` (correct `name`, `sql_on`, optional `label` / `fields`).
- [ ] Do not invent tables that are not in the dbt project.
- [ ] Run `dbt parse` / `dbt compile`.
- [ ] Tell the user to refresh project artifacts / explores in the app.

## How the app behaves

- **Valid join:** second table group in the fields panel; queries can `JOIN` that table when its fields are selected.
- **Invalid join** (typo’d `join`, missing `sql_on`, etc.): explore still loads; the bad target appears as a **greyed-out, non-selectable** group with a tooltip (often including “Did you mean `correct_name`?”). Fix the YAML and refresh.

## Prompt stub

```text
Update this dbt project so explores declare Lightdash-compatible meta.joins.
Follow docs/dbt-yaml-joins-for-llms.md exactly. Only edit YAML (schema.yml);
do not change SQL unless a join key is missing. After edits, list files changed
and the dbt commands I should run.
```

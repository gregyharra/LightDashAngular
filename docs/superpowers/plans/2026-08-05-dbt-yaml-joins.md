# dbt YAML Joins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Parse Lightdash-style `meta.joins` into explores with best-effort resolution, show unresolved joins as non-selectable field groups with tooltips, and document YAML for LLMs.

**Architecture:** Attach `joins` from dbt manifest meta onto lineage nodes; `build_explore_from_lineage_node(node, lineage)` resolves targets into `joinedTables`/`tables` or `joinIssues`. UI maps issues to disabled field groups.

**Tech Stack:** Python/FastAPI (`mds-backend`), Angular (`mds-ui`), pytest, Jasmine/Karma.

**Spec:** `docs/superpowers/specs/2026-08-05-dbt-yaml-joins-design.md`

## Global Constraints

- Best-effort: never 500/404 an explore solely because join metadata is wrong.
- Invalid joins must still appear in the fields panel as non-selectable groups with tooltip.
- Do not update `mds-transform` YAML in this work (docs guide only).
- Do not change the left Tables/Explores tree selection behavior.
- Lightdash-compatible keys: `join`, `sql_on`, `type`, `label`, `relationship`, `fields`.
- Follow TDD: failing test first for each behavior.
- Match existing code style in touched files.

## File map

| File | Responsibility |
|------|----------------|
| `mds-backend/src/mds/services/dbt/parse.py` | Extract joins onto lineage; resolve joins when building explore |
| `mds-backend/src/mds/routers/semantic.py` | Pass lineage into explore builder |
| `mds-backend/src/mds/routers/query.py` | Pass lineage into explore builder |
| `mds-backend/tests/test_explore_joins.py` | Unit tests for join resolution |
| `mds-ui/.../explore.model.ts` | `ExploreJoinIssue` + `joinIssues` on `Explore` |
| `mds-ui/.../tables-fields-panel/*` | Disabled issue groups + tooltip |
| `mds-ui/.../tables-workspace-page/*` | Map `joinIssues` into field groups |
| `docs/dbt-yaml-joins-for-llms.md` | LLM-ready YAML guide |

---

### Task 1: Backend join extraction + explore resolution

**Files:**
- Modify: `mds-backend/src/mds/services/dbt/parse.py`
- Create: `mds-backend/tests/test_explore_joins.py`
- Modify: `mds-backend/src/mds/routers/semantic.py`
- Modify: `mds-backend/src/mds/routers/query.py`

**Interfaces:**
- Produces: `build_explore_from_lineage_node(node: dict, lineage: dict | None = None) -> dict` with `joinedTables`, `tables`, optional `joinIssues`
- Produces lineage node field `joins: list[dict]` (raw meta joins, may be `[]`)
- Consumes: existing `_format_words`, dimension/metric builders inside `build_explore_from_lineage_node`

- [ ] **Step 1: Write failing tests** in `mds-backend/tests/test_explore_joins.py`:

```python
from mds.services.dbt.parse import build_explore_from_lineage_node


def _node(name: str, columns: list[dict] | None = None, joins: list | None = None) -> dict:
    return {
        "id": f"model.test.{name}",
        "name": name,
        "type": "mart",
        "schema": "analytics",
        "database": "lake",
        "columns": columns
        or [
            {"name": "id", "type": "integer"},
            {"name": "customer_id", "type": "integer"},
            {"name": "amount", "type": "double"},
        ],
        "description": None,
        "tags": [],
        "joins": joins or [],
    }


def test_valid_join_adds_table_and_joined_tables():
    base = _node(
        "fct_orders",
        joins=[
            {
                "join": "dim_customers",
                "sql_on": "${fct_orders.customer_id} = ${dim_customers.customer_id}",
                "type": "left",
                "label": "Customers",
                "relationship": "many-to-one",
            }
        ],
    )
    joined = _node(
        "dim_customers",
        columns=[
            {"name": "customer_id", "type": "integer"},
            {"name": "first_name", "type": "varchar"},
        ],
    )
    lineage = {"nodes": [base, joined]}
    explore = build_explore_from_lineage_node(base, lineage)
    assert explore["joinedTables"] == [
        {
            "table": "dim_customers",
            "sqlOn": "${fct_orders.customer_id} = ${dim_customers.customer_id}",
            "type": "left",
            "label": "Customers",
            "relationship": "many-to-one",
        }
    ]
    assert "dim_customers" in explore["tables"]
    assert "first_name" in explore["tables"]["dim_customers"]["dimensions"]
    assert explore.get("joinIssues") in (None, [])


def test_missing_join_target_emits_issue_with_suggestion():
    base = _node(
        "fct_orders",
        joins=[{"join": "dim_customer", "sql_on": "${fct_orders.customer_id} = ${dim_customer.customer_id}"}],
    )
    sibling = _node("dim_customers")
    lineage = {"nodes": [base, sibling]}
    explore = build_explore_from_lineage_node(base, lineage)
    assert explore["joinedTables"] == []
    assert "fct_orders" in explore["tables"]
    assert len(explore["joinIssues"]) == 1
    issue = explore["joinIssues"][0]
    assert issue["code"] == "JOIN_TARGET_NOT_FOUND"
    assert issue["table"] == "dim_customer"
    assert issue["suggestion"] == "dim_customers"
    assert issue["severity"] == "error"


def test_missing_sql_on_emits_issue():
    base = _node("fct_orders", joins=[{"join": "dim_customers"}])
    lineage = {"nodes": [base, _node("dim_customers")]}
    explore = build_explore_from_lineage_node(base, lineage)
    assert explore["joinedTables"] == []
    assert explore["joinIssues"][0]["code"] == "JOIN_MISSING_SQL_ON"


def test_fields_whitelist_limits_joined_dimensions_and_metrics():
    base = _node(
        "fct_orders",
        joins=[
            {
                "join": "dim_customers",
                "sql_on": "${fct_orders.customer_id} = ${dim_customers.customer_id}",
                "fields": ["first_name"],
            }
        ],
    )
    joined = _node(
        "dim_customers",
        columns=[
            {"name": "customer_id", "type": "integer"},
            {"name": "first_name", "type": "varchar"},
            {"name": "last_name", "type": "varchar"},
        ],
    )
    explore = build_explore_from_lineage_node(base, {"nodes": [base, joined]})
    dims = explore["tables"]["dim_customers"]["dimensions"]
    assert set(dims.keys()) == {"first_name"}
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd mds-backend && python -m pytest tests/test_explore_joins.py -v
```

Expected: FAIL (signature/behavior missing).

- [ ] **Step 3: Implement**

In `parse.py` when building each `lineage_node`, set:

```python
meta = {}
meta.update(node.get("meta") or {})
meta.update((node.get("config") or {}).get("meta") or {})
lineage_node["joins"] = list(meta.get("joins") or [])
```

(`config.meta` overrides top-level `meta` keys via later `update` — for `joins` specifically: if `config.meta` has `joins`, it wins; if only top-level has joins, keep those. Prefer: `joins = (config.meta or {}).get("joins")` if key present else `(meta or {}).get("joins")`.)

Exact precedence per spec: first non-empty wins — prefer `config.meta.joins` if truthy, else `meta.joins`.

Refactor `build_explore_from_lineage_node`:

```python
def build_explore_from_lineage_node(
    node: dict[str, Any],
    lineage: dict[str, Any] | None = None,
) -> dict[str, Any]:
    # existing base table build ...
    joined_tables: list[dict[str, Any]] = []
    join_issues: list[dict[str, Any]] = []
    tables = {table_name: compiled_table}

    nodes = (lineage or {}).get("nodes") or []
    nodes_by_name = {n["name"]: n for n in nodes}

    for raw in node.get("joins") or []:
        # validate + resolve; on success build joined compiled table via shared helper
        # that mirrors base dimension/metric construction (extract _compiled_table_from_node)
        ...

    result = { ..., "joinedTables": joined_tables, "tables": tables }
    if join_issues:
        result["joinIssues"] = join_issues
    return result
```

Suggestion helper:

```python
import difflib

def _suggest_join_target(name: str, candidates: list[str]) -> str | None:
    matches = difflib.get_close_matches(name, candidates, n=1, cutoff=0.6)
    return matches[0] if matches else None
```

Update callers:

```python
# semantic.py / query.py
explore = build_explore_from_lineage_node(node, lineage)
```

Keep `lineage=None` backward compatible for any tests that call with one arg (joinedTables stays `[]`).

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd mds-backend && python -m pytest tests/test_explore_joins.py -v
```

- [ ] **Step 5: Commit**

```bash
git add mds-backend/tests/test_explore_joins.py mds-backend/src/mds/services/dbt/parse.py \
  mds-backend/src/mds/routers/semantic.py mds-backend/src/mds/routers/query.py
git commit -m "$(cat <<'EOF'
feat: resolve dbt meta.joins into explore joinedTables

Parse Lightdash-style joins from manifest meta with best-effort issues
when targets or sql_on are invalid.
EOF
)"
```

---

### Task 2: Frontend types + disabled join-issue field groups

**Files:**
- Modify: `mds-ui/src/app/core/models/explore.model.ts`
- Modify: `mds-ui/src/app/features/explorer/tables-fields-panel/tables-fields-panel.component.ts`
- Modify: `mds-ui/src/app/features/explorer/tables-fields-panel/tables-fields-panel.component.html`
- Modify: `mds-ui/src/app/features/explorer/tables-fields-panel/tables-fields-panel.component.scss`
- Modify: `mds-ui/src/app/features/explorer/tables-workspace-page/tables-workspace-page.component.ts`
- Create/Modify: `mds-ui/src/app/features/explorer/tables-fields-panel/tables-fields-panel.component.spec.ts`

**Interfaces:**
- Consumes: `Explore.joinIssues?: ExploreJoinIssue[]`
- Produces: `TablesFieldGroup.issue?: ExploreJoinIssue` (or parallel shape)

- [ ] **Step 1: Write failing component test** asserting an issue group shows the table label, does not expose field toggle buttons, and tooltip/message includes suggestion text.

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless --include='**/tables-fields-panel.component.spec.ts'
```

- [ ] **Step 3: Implement types + UI**

`explore.model.ts`:

```typescript
export type ExploreJoinIssue = {
  table: string;
  label?: string;
  code: 'JOIN_TARGET_NOT_FOUND' | 'JOIN_MISSING_SQL_ON' | 'JOIN_INVALID';
  message: string;
  severity: 'warning' | 'error';
  suggestion?: string;
};

export type Explore = {
  // existing...
  joinIssues?: ExploreJoinIssue[];
};
```

Extend `TablesFieldGroup`:

```typescript
export type TablesFieldGroup = {
  table: { name: string; label: string };
  dimensions: ...;
  metrics: ...;
  issue?: ExploreJoinIssue;
};
```

In `tables-workspace-page` `tableGroups` computed: after mapping `explore.tables`, append groups for each `joinIssues` entry:

```typescript
{
  table: {
    name: issue.table,
    label: issue.label || formatWords(issue.table),
  },
  dimensions: [],
  metrics: [],
  issue,
}
```

In fields panel template, when `group.issue` is set:

- Add class `tables-fields-panel__section--issue`
- Header shows warning/error icon + label
- `[matTooltip]="issueTooltip(group.issue)"` 
- Do not render dimension/metric lists (or render empty with hint)
- `issueTooltip`: `` `${issue.message}${issue.suggestion ? ` Did you mean ${issue.suggestion}?` : ''}` ``

Styles: muted opacity, `pointer-events: none` on section body, keep tooltip trigger interactive (`pointer-events: auto` on header).

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: show unresolved explore joins as disabled field groups

Surface joinIssues in the fields panel with tooltips and optional
Did you mean suggestions.
EOF
)"
```

---

### Task 3: LLM-ready dbt joins documentation

**Files:**
- Create: `docs/dbt-yaml-joins-for-llms.md`
- Keep: `docs/superpowers/specs/2026-08-05-dbt-yaml-joins-design.md` (already written)

- [ ] **Step 1: Write** `docs/dbt-yaml-joins-for-llms.md` as a self-contained prompt:

Include:
- Purpose (copy-paste for an LLM updating a dbt project)
- Rule: joins are YAML metadata, not inferred from SQL
- Exact YAML examples (`meta.joins` and `config.meta.joins`)
- Field table matching the spec
- Example for `fct_orders` → `dim_customers` using `${...}` syntax
- Guidance: prefer joins when tables are separate models; if SQL already denormalizes, either keep wide table OR remodel + join — don’t double-expose the same columns without intent
- Checklist: name matches dbt model `name`, `sql_on` uses `${model.column}`, run `dbt parse`/`compile`, refresh explores in app
- How UI behaves when a join target is wrong

- [ ] **Step 2: Commit**

```bash
git add docs/dbt-yaml-joins-for-llms.md docs/superpowers/specs/2026-08-05-dbt-yaml-joins-design.md docs/superpowers/plans/2026-08-05-dbt-yaml-joins.md
git commit -m "$(cat <<'EOF'
docs: add LLM guide for dbt YAML joins

Document Lightdash-compatible meta.joins so agents can update dbt
projects for multi-table explores.
EOF
)"
```

---

## Self-review

1. Spec coverage: parse joins ✅, best-effort + issues ✅, fields panel disabled + tooltip ✅, LLM doc ✅, no mds-transform YAML ✅, no tree changes ✅.
2. No placeholders.
3. Types: `sqlOn` camelCase in API (matches existing `ExploreJoin`), `joinIssues` optional array.

# Lineage tree + model cards UI polish (Approach 1)

**Date:** 2026-07-30  
**Status:** Approved for implementation planning  
**Surfaces:** Lineage page, Tables hub / workspace (shared `folder-search-panel` + lineage graph)

## Context

LightDashAngular already ships a usable Lineage experience: a shared `folder-search-panel` tree, an SVG lineage graph with Focus/Full + hop depth, column expand on nodes, and column-lineage mode. Backend column lineage (SQLGlot) is already on main.

This iteration is **incremental polish** of those surfaces — denser, clearer tree navigation and card-style graph nodes with neighborhood expand — **not** a new colibri HTML shell and **not** a color-system redesign. Keep today’s fill/border coloring by model layer/type (`NODE_COLORS` / existing tree styling).

## Goals

1. **Tree (`folder-search-panel`):** path tree with descendant leaf counts, clearer resource-type icons, and a folder ↔ schema view toggle; colors unchanged.
2. **Graph nodes:** card UI with header (type icon, name, column count, chevron), optional column body, and −/+ footer for one-hop neighborhood expand without changing focus or auto-recentering.
3. Apply on **both** Lineage page and Tables hub/workspace / lineage tab where those components already appear.
4. Preserve Focus/Full, hop controls, selection behavior, and column-lineage edge behavior.

## Non-goals

- Renaming Model Info / Lineage / ERD tabs.
- Full colibri HTML rewrite or new page shell.
- Changing the layer/type color palette.
- Backend SQLGlot or lineage API work (already on main).
- Persisting prefs across browser sessions beyond the existing localStorage pattern (see State model). Cross-device or server-side UI prefs are out of scope.

## Approach

**Approach 1 — polish in place.**

| Surface | Change |
|---------|--------|
| `folder-search-panel` | Counts, icons, folder/schema toggle, session persistence of expand + view mode |
| `lineage-graph` nodes | Card chrome + column collapse default + −/+ neighborhood expansion set |
| Shared consumers | Lineage page + Tables hub/workspace lineage tab — same components, no duplicate implementations |

Reuse existing data: `DbtTreeNode` + `lineageNodeId` for selection; `LineageNode.schema` / `columns` / `type` for schema grouping and card body. No new backend endpoints.

---

## Tree behavior

### Folder view (default)

- Keep today’s **path-based** folder tree.
- Each **folder** row shows a **descendant leaf count** (selectable models/seeds/sources under that folder, after the active filter).
- **Icons** by resource type (`folder`, `model`, `seed`, `source`, `sources_file`, etc.) — clearer Material icons; **colors unchanged**.
- Selecting a leaf still emits / selects by `lineageNodeId` (unchanged).

### Schema view

- Toggle control in the panel header: **folder icon** ↔ **database icon** (folder view vs schema view).
- Group leaves by **warehouse schema** from lineage/node metadata (`LineageNode.schema`, joined via `lineageNodeId`).
- Missing / empty schema → group label **“Unspecified”**.
- Same filter, same descendant counts on group rows, same selection via `lineageNodeId`.
- Schema groups are folders in the tree UX (expand/collapse); leaves remain selectable nodes.

### Filter

- Keep existing **“Filter models…”** (or current placeholder) matching name / path / description.
- **Ancestors of matches stay visible** so the tree context is preserved (existing `filterTreeNodes` behavior; extend equivalently for schema-grouped trees).

### Empty / loading / error

- Unchanged from today’s panel / page empty, loading, and error states.

---

## Graph card behavior

### Card chrome

| Region | Content |
|--------|---------|
| **Header** | Type icon, model name, “N columns”, chevron to expand/collapse column list |
| **Body** | Column names; type hints (`#` numeric / `Aa` text-like) **only when** a type string exists from catalog/manifest (`LineageColumn.type`) |
| **Footer** | **−** (direct upstream) and **+** (direct downstream) |

- Keep today’s **fill / border by layer/type**; selection ring as today.
- Column list **defaults collapsed**.
- **Chevron only** toggles the column list (does not change selection, focus, or neighborhood).
- Wide column lists scroll **inside the card** (`overflow` on the body), never grow the page horizontally.

### − / + neighborhood expand

- **−** reveals **one hop** of **direct upstream** neighbors of that node.
- **+** reveals **one hop** of **direct downstream** neighbors of that node.
- Does **not** change the selected / focused model.
- Does **not** auto-recenter / fit-to-view on that click alone.
- Works in **both Focus and Full** graph modes.
- In **Focus**: visible set = (hop-limited subgraph around the focus root) ∪ (manually expanded neighbors from −/+).
- **Collapsing −/+** (toggle off) only removes neighbors that were added via that expansion and are **not** still required by the current hop window or by another node’s expansion.
- Disabled / no-op when that side has **no direct neighbors**.

### Column lineage mode

- Same card shell (header / body / footer).
- Existing column-edge highlight, column selection, and dimming behavior preserved.
- Chevron / column body remain available as today for inspecting columns; −/+ still expand model neighborhood without changing focus.

### Selection

- Clicking a node (outside −/+/chevron) selects / focuses as today.
- Selecting another model **does not** auto-expand its neighbors.
- Changing focus root (new selection) **resets** the manual neighborhood expansion set (see State model).

---

## State model

### Tree (`folder-search-panel`)

| State | Scope | Persistence |
|-------|--------|-------------|
| Search query | Component | In-memory (cleared on navigate away as today) |
| Expanded folder / schema group paths | Per project | **Session-oriented via localStorage**, keyed by project (see below) |
| Folder vs schema view | Per project | Same as expanded paths |

**Codebase note (resolved):** The panel already persists **collapsed** and **width** with `localStorage` (`collapsedStorageKey` input, width key derived similarly). Expanded paths today are **in-memory only** (`expandedPaths` signal, reset from `getDefaultExpandedPaths` when the tree loads). There is **no** separate UI-prefs service.

**Decision:** Follow the existing **localStorage** pattern for the new prefs (expanded paths + `folder` \| `schema` view), with keys namespaced by **project UUID** (and surface if Lineage vs Tables already use distinct collapse keys). Treat “session” as browser-local persistence for the duration the key remains (same durability as panel width/collapse — not a new ephemeral-only store unless implementation prefers `sessionStorage` for expand state only; default to **localStorage** for consistency with existing panel prefs).

### Graph (`lineage-graph`)

| State | Meaning | Lifetime |
|-------|---------|----------|
| `expandedNodeIds` (or equivalent) | Columns body open/closed per node | In-memory; default **all collapsed** on load / mode entry as designed |
| Manual neighborhood set | Node IDs brought in via −/+ | In-memory |
| Focus root / `selectedNodeId` | Current selection | Existing parent state |
| `hopDepth` / `graphMode` | Focus window | Existing |
| Column selection / view mode | Column lineage | Existing |

**Visible nodes (Focus):**

```
visible = hopWindow(focusRoot, hopDepth) ∪ manualNeighborhood
```

**Visible nodes (Full):** all graph nodes remain available; −/+ still tracks manual expands for collapse semantics and any focus-dimming rules that already apply — but Full does not hide the rest of the graph.

**Reset manual neighborhood when:**

- User selects a **different** focus root (new `selectedNodeId`), or
- Explicit clear (if a clear control exists later; not required in this polish).

**Keep manual neighborhood when:**

- Toggling Focus ↔ Full, or
- Changing hop depth (union still applies; hop window may cover more/fewer nodes without wiping manual expands).

**Collapse −/+ on a node:** remove from `manualNeighborhood` only those neighbors that (a) were contributed by that node’s expand on that side, and (b) are not still in the hop window and not still required by another expansion.

---

## Edge cases

| Case | Behavior |
|------|----------|
| No upstream / no downstream | − or + disabled or no-op |
| Focus ↔ Full | Keep manual expansions |
| Hop depth change | Keep manual expansions; recompute hop window |
| New focus selection | Reset manual expansions; do not auto-expand neighbors |
| Missing schema | Schema group **“Unspecified”** |
| No column types | Show names only; omit `#` / `Aa` hints |
| Empty columns list | “0 columns”; chevron may be disabled or no-op |
| Empty / loading / error tree or graph | Unchanged |
| Wide columns | Scroll inside card body |
| Column lineage mode | Card shell + existing edge/selection behavior |
| Shared panel on Lineage + Tables | Same component behavior; prefs keys must not cross-contaminate projects |

---

## Verification

- [ ] Tree leaf counts, filter (ancestors visible), and folder/schema toggle on **Lineage** and **Tables** hub/workspace.
- [ ] Schema grouping uses warehouse schema; missing → “Unspecified”; selection still by `lineageNodeId`.
- [ ] Expanded folders + view mode persist per project via the chosen localStorage keys across panel remounts in the same browser.
- [ ] Graph cards: collapsed by default; chevron toggles columns only; fill/border/selection ring unchanged.
- [ ] Focus + hop: −/+ add one-hop neighbors without changing selection or auto-recenter; collapse removes only eligible manual neighbors.
- [ ] Full mode: −/+ still work; no focus change on those clicks.
- [ ] Column lineage mode still highlights edges / columns correctly with the new card shell.
- [ ] Smoke in **Chromium and Firefox**; **no horizontal page scroll** (card-internal scroll only for long column lists).

---

## Open questions

None remaining for planning. Resolved during design:

1. **Persistence:** use existing **localStorage** panel-pref pattern (not a new prefs service); key by project for expand + view mode.
2. **Schema source:** `LineageNode.schema` via `lineageNodeId` (already on the lineage model).
3. **Type hints:** only when `LineageColumn.type` is present; simple `#` / `Aa` mapping is an implementation detail (numeric-ish vs other), not a new catalog API.
4. **Manual expand reset:** on focus-root change only (not on Focus/Full or hop change).

---

## Self-review

| Check | Result |
|-------|--------|
| TBD / TODO left in body | None |
| Contradictions | None: chevron ≠ −/+; −/+ ≠ selection; Focus visible set is hop ∪ manual |
| Ambiguity | Collapse semantics spelled out (only remove neighbors not required by hop or other expands) |
| Scope creep | Non-goals exclude colibri rewrite, color palette, tab rename, backend |
| Surfaces | Explicitly Lineage + Tables shared components |
| Persistence | Resolved against codebase: localStorage like collapse/width; expand was in-memory — extend pattern |
| Cross-browser / overflow | Verification includes Chromium + Firefox and no page horizontal scroll |

**Ready for:** implementation planning (writing-plans), then implementation. Do not start coding from this doc alone without a task plan.

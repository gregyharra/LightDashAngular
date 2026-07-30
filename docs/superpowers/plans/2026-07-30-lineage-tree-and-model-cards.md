# Lineage Tree + Model Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the shared `folder-search-panel` (leaf counts, clearer icons, folder↔schema toggle + localStorage prefs) and `lineage-graph` nodes (card chrome, collapsed columns by default, −/+ one-hop neighborhood expand without changing focus) on both Lineage and Tables surfaces.

**Architecture:** Keep Approach 1 in place — no new backend, no color redesign. Extend pure utils (`dbt-tree-utils`, new `lineage-neighborhood-utils`, small type-hint helper) with TDD; wire them into the existing Angular components. Extract neighborhood math out of the already-large `lineage-graph` (~1200 LOC TS) rather than splitting the SVG template mid-feature. Schema grouping joins `DbtTreeNode.lineageNodeId` → `LineageNode.schema` via a new panel input.

**Tech Stack:** Angular 19 (signals/inputs), Jasmine/Karma (`ng test`), Material icons, existing `NODE_COLORS` / tree CSS variables.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-30-lineage-tree-and-model-cards-design.md` (Approach 1 only).
- Keep today’s fill/border coloring by layer/type (`NODE_COLORS` in `lineage-graph.component.ts` and existing tree icon color classes) — do not redesign the palette.
- Shared components only: `folder-search-panel` + `lineage-graph` used by Lineage page and Tables hub/workspace — no duplicate implementations.
- Persistence: extend existing **localStorage** panel-pref pattern (collapse/width); key expanded paths + folder|schema view by **project UUID** (and existing surface-specific `collapsedStorageKey` prefixes).
- Focus visible set: `hopWindow(focusRoot, hopDepth) ∪ manualNeighborhood`. Full mode keeps showing all nodes; −/+ still track expansions for collapse.
- −/+ must not change selection/focus and must not auto-recenter/fit-to-view on that click alone.
- Reset manual neighborhood when focus root (`selectedNodeId`) changes; keep it across Focus↔Full and hop depth changes.
- Column type hints (`#` / `Aa`) only when `LineageColumn.type` is non-empty.
- Column list defaults collapsed in models mode; chevron toggles columns only.
- Chromium + Firefox; no horizontal page scroll — wide column lists scroll inside the card body only.
- Prefer unit tests for utils (project pattern: `*.utils.spec.ts` / sibling `*.spec.ts`). No new component specs required unless a task explicitly needs one.
- Test runner: from `mds-ui/`, `npx ng test --no-watch --browsers=ChromeHeadless` (optionally scope with Karma `grep` via `--include` if supported by the installed CLI; otherwise run the suite and rely on spec file names).

## File map

| File | Responsibility |
|------|----------------|
| `mds-ui/src/app/features/lineage/dbt-tree-utils.ts` | Leaf counts, schema-grouped tree builder, icon name helper (if extracted) |
| `mds-ui/src/app/features/lineage/dbt-tree-utils.spec.ts` | **New** — TDD for counts + schema tree + filter |
| `mds-ui/src/app/features/lineage/folder-search-panel/folder-search-panel.component.ts` | View toggle, counts UI wiring, lineageNodes + projectUuid inputs, localStorage for expand + view |
| `mds-ui/src/app/features/lineage/folder-search-panel/folder-search-panel.component.html` | Count badges, folder↔schema toggle, schema-group rows |
| `mds-ui/src/app/features/lineage/folder-search-panel/folder-search-panel.component.scss` | Count + toggle styles; keep overflow contained |
| `mds-ui/src/app/features/lineage/lineage-neighborhood-utils.ts` | **New** — manual −/+ expansion state + visible-id union |
| `mds-ui/src/app/features/lineage/lineage-neighborhood-utils.spec.ts` | **New** — TDD for expand/collapse/reset/union |
| `mds-ui/src/app/features/lineage/column-type-hint.utils.ts` | **New** — `#` / `Aa` / `null` from column type string |
| `mds-ui/src/app/features/lineage/column-type-hint.utils.spec.ts` | **New** — TDD for type hints |
| `mds-ui/src/app/features/lineage/lineage-column-utils.ts` | Header/footer height constants; expanded card height includes footer |
| `mds-ui/src/app/features/lineage/lineage-layout.ts` | Collapsed/expanded node height includes footer strip |
| `mds-ui/src/app/features/lineage/lineage-graph/lineage-graph.component.ts` | Manual neighborhood signal; displayNodes/Edges union; card helpers; no-fit on −/+ |
| `mds-ui/src/app/features/lineage/lineage-graph/lineage-graph.component.html` | Card header/body/footer markup |
| `mds-ui/src/app/features/lineage/lineage-graph/lineage-graph.component.scss` | Card chrome; body `overflow` for columns; no page growth |
| `mds-ui/src/app/features/lineage/lineage-page/lineage-page.component.html` | Pass `projectUuid` + `lineageNodes` into panel |
| `mds-ui/src/app/features/tables/table-hub-page/table-hub-page.component.html` | Same panel inputs |
| `mds-ui/src/app/features/explorer/tables-workspace-page/tables-workspace-page.component.html` | Same panel inputs (workspace already has projectUuid nearby) |

**Split note:** Do **not** extract a new graph component unless a later task proves the HTML edit is unreviewable. Prefer the new utils files above. `lineage-focus-utils.ts` already exports `getDirectUpstreamIds` / `getDirectDownstreamIds` — reuse them; do not duplicate adjacency.

---

### Task 1: Descendant leaf counts + clearer tree icons

**Files:**
- Modify: `mds-ui/src/app/features/lineage/dbt-tree-utils.ts`
- Create: `mds-ui/src/app/features/lineage/dbt-tree-utils.spec.ts`
- Modify: `mds-ui/src/app/features/lineage/folder-search-panel/folder-search-panel.component.ts`
- Modify: `mds-ui/src/app/features/lineage/folder-search-panel/folder-search-panel.component.html`
- Modify: `mds-ui/src/app/features/lineage/folder-search-panel/folder-search-panel.component.scss`

**Interfaces:**
- Consumes: existing `DbtTreeNode`, `filterTreeNodes`, `flattenVisibleTree`
- Produces:
  - `countSelectableDescendants(node: DbtTreeNode): number`
  - `iconForDbtTreeType(type: DbtTreeNode['type']): string` (moved out of the component so tests can assert icon names)

- [ ] **Step 1: Write the failing tests**

Create `mds-ui/src/app/features/lineage/dbt-tree-utils.spec.ts`:

```typescript
import { DbtTreeNode } from '../../core/models/lineage.model';
import {
  countSelectableDescendants,
  filterTreeNodes,
  iconForDbtTreeType,
} from './dbt-tree-utils';

function folder(name: string, children: DbtTreeNode[], path = name): DbtTreeNode {
  return { id: `folder:${path}`, name, path, type: 'folder', children };
}

function leaf(
  name: string,
  lineageNodeId: string,
  type: DbtTreeNode['type'] = 'model',
): DbtTreeNode {
  return {
    id: lineageNodeId,
    name,
    path: `models/${name}.sql`,
    type,
    lineageNodeId,
  };
}

describe('countSelectableDescendants', () => {
  it('counts selectable leaves under a folder, not the folder itself', () => {
    const tree = folder('models', [
      folder('staging', [leaf('stg_orders', 'model.j.stg_orders')], 'models/staging'),
      leaf('fct_orders', 'model.j.fct_orders'),
    ], 'models');

    expect(countSelectableDescendants(tree)).toBe(2);
    expect(countSelectableDescendants(tree.children![0])).toBe(1);
  });

  it('returns 0 for a leaf without children', () => {
    expect(countSelectableDescendants(leaf('x', 'model.j.x'))).toBe(0);
  });

  it('counts after filterTreeNodes (filtered tree only)', () => {
    const tree = [
      folder('models', [
        leaf('stg_orders', 'model.j.stg_orders'),
        leaf('fct_orders', 'model.j.fct_orders'),
      ], 'models'),
    ];
    const filtered = filterTreeNodes(tree, 'stg');
    expect(countSelectableDescendants(filtered[0])).toBe(1);
  });
});

describe('iconForDbtTreeType', () => {
  it('maps resource types to clearer Material icon names', () => {
    expect(iconForDbtTreeType('folder')).toBe('folder');
    expect(iconForDbtTreeType('model')).toBe('table_chart');
    expect(iconForDbtTreeType('seed')).toBe('eco');
    expect(iconForDbtTreeType('source')).toBe('storage');
    expect(iconForDbtTreeType('sources_file')).toBe('description');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless --include='**/dbt-tree-utils.spec.ts'`

Expected: FAIL (missing exports / module symbols).

- [ ] **Step 3: Implement utils**

Add to `mds-ui/src/app/features/lineage/dbt-tree-utils.ts`:

```typescript
import { DbtTreeNode } from '../../core/models/lineage.model';

export function countSelectableDescendants(node: DbtTreeNode): number {
  let count = 0;
  const visit = (items: DbtTreeNode[]): void => {
    for (const item of items) {
      if (item.lineageNodeId) {
        count += 1;
      }
      if (item.children?.length) {
        visit(item.children);
      }
    }
  };
  visit(node.children ?? []);
  return count;
}

export function iconForDbtTreeType(type: DbtTreeNode['type']): string {
  switch (type) {
    case 'folder':
      return 'folder';
    case 'model':
      return 'table_chart';
    case 'seed':
      return 'eco';
    case 'source':
      return 'storage';
    case 'sources_file':
      return 'description';
    default:
      return 'insert_drive_file';
  }
}
```

Keep existing helpers (`filterTreeNodes`, `flattenVisibleTree`, etc.) unchanged in this task.

- [ ] **Step 4: Wire panel UI**

In `folder-search-panel.component.ts`:

- Import `countSelectableDescendants`, `iconForDbtTreeType`.
- Replace `iconForType` body with `return iconForDbtTreeType(type);`.
- Add:

```typescript
protected leafCount(node: DbtTreeNode): number {
  return countSelectableDescendants(node);
}

protected showLeafCount(node: DbtTreeNode): boolean {
  return node.type === 'folder' || !!(node.children?.length);
}
```

In `folder-search-panel.component.html`, after the label button, add:

```html
@if (showLeafCount(item.node)) {
  <span class="folder-panel__count" aria-label="{{ leafCount(item.node) }} items">
    {{ leafCount(item.node) }}
  </span>
}
```

In SCSS, add a compact count badge that does not force horizontal page overflow (shrink label with `min-width: 0`; count `flex-shrink: 0`):

```scss
.folder-panel__item {
  // ensure existing row is flex; add if missing:
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.folder-panel__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-panel__count {
  flex-shrink: 0;
  margin-left: auto;
  padding: 0 6px;
  border-radius: 999px;
  font-size: 11px;
  line-height: 18px;
  color: var(--ld-gray-7, #495057);
  background: var(--ld-gray-1, #f1f3f5);
}
```

Do **not** change icon color classes (`folder-panel__icon--{{ type }}`).

- [ ] **Step 5: Re-run tests**

Run: `cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless --include='**/dbt-tree-utils.spec.ts'`

Expected: PASS for Task 1 specs.

- [ ] **Step 6: Commit**

```bash
git add \
  mds-ui/src/app/features/lineage/dbt-tree-utils.ts \
  mds-ui/src/app/features/lineage/dbt-tree-utils.spec.ts \
  mds-ui/src/app/features/lineage/folder-search-panel/folder-search-panel.component.ts \
  mds-ui/src/app/features/lineage/folder-search-panel/folder-search-panel.component.html \
  mds-ui/src/app/features/lineage/folder-search-panel/folder-search-panel.component.scss
git commit -m "$(cat <<'EOF'
feat(ui): show tree leaf counts and clearer dbt icons

EOF
)"
```

---

### Task 2: Schema-grouped tree builder

**Files:**
- Modify: `mds-ui/src/app/features/lineage/dbt-tree-utils.ts`
- Modify: `mds-ui/src/app/features/lineage/dbt-tree-utils.spec.ts`

**Interfaces:**
- Consumes: `collectSelectableNodes`, `DbtTreeNode`, `LineageNode.schema`
- Produces:
  - `export const UNSPECIFIED_SCHEMA_LABEL = 'Unspecified'`
  - `buildSchemaGroupedTree(pathTree: DbtTreeNode[], schemaByLineageNodeId: ReadonlyMap<string, string>): DbtTreeNode[]`
  - Schema group nodes use `type: 'folder'`, `path: \`schema:${label}\``, `id: \`schema:${label}\``, `name: label`, children = selectable leaves (cloned with same `lineageNodeId`)

- [ ] **Step 1: Write the failing tests**

Append to `dbt-tree-utils.spec.ts`:

```typescript
import {
  UNSPECIFIED_SCHEMA_LABEL,
  buildSchemaGroupedTree,
  findAncestorFolderPaths,
  filterTreeNodes,
} from './dbt-tree-utils';

describe('buildSchemaGroupedTree', () => {
  const pathTree: DbtTreeNode[] = [
    {
      id: 'folder:models',
      name: 'models',
      path: 'models',
      type: 'folder',
      children: [
        {
          id: 'model.j.stg_orders',
          name: 'stg_orders',
          path: 'models/staging/stg_orders.sql',
          type: 'model',
          lineageNodeId: 'model.j.stg_orders',
        },
        {
          id: 'model.j.fct_orders',
          name: 'fct_orders',
          path: 'models/marts/fct_orders.sql',
          type: 'model',
          lineageNodeId: 'model.j.fct_orders',
        },
        {
          id: 'model.j.orphan',
          name: 'orphan',
          path: 'models/orphan.sql',
          type: 'model',
          lineageNodeId: 'model.j.orphan',
        },
      ],
    },
  ];

  const schemas = new Map<string, string>([
    ['model.j.stg_orders', 'staging'],
    ['model.j.fct_orders', 'marts'],
    ['model.j.orphan', ''],
  ]);

  it('groups leaves by warehouse schema and uses Unspecified for missing/empty', () => {
    const grouped = buildSchemaGroupedTree(pathTree, schemas);
    const names = grouped.map((n) => n.name).sort();
    expect(names).toEqual(['marts', 'staging', UNSPECIFIED_SCHEMA_LABEL].sort());

    const unspecified = grouped.find((n) => n.name === UNSPECIFIED_SCHEMA_LABEL)!;
    expect(unspecified.type).toBe('folder');
    expect(unspecified.path).toBe(`schema:${UNSPECIFIED_SCHEMA_LABEL}`);
    expect(unspecified.children!.map((c) => c.lineageNodeId)).toEqual(['model.j.orphan']);
  });

  it('preserves lineageNodeId selection on leaves', () => {
    const grouped = buildSchemaGroupedTree(pathTree, schemas);
    const marts = grouped.find((n) => n.name === 'marts')!;
    expect(marts.children![0].lineageNodeId).toBe('model.j.fct_orders');
  });

  it('keeps ancestors of filter matches visible', () => {
    const grouped = buildSchemaGroupedTree(pathTree, schemas);
    const filtered = filterTreeNodes(grouped, 'stg_orders');
    expect(filtered).toHaveSize(1);
    expect(filtered[0].name).toBe('staging');
    expect(filtered[0].children![0].lineageNodeId).toBe('model.j.stg_orders');
  });

  it('findAncestorFolderPaths works for schema groups', () => {
    const grouped = buildSchemaGroupedTree(pathTree, schemas);
    expect(findAncestorFolderPaths(grouped, 'model.j.fct_orders')).toEqual(['schema:marts']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless --include='**/dbt-tree-utils.spec.ts'`

Expected: FAIL — `buildSchemaGroupedTree` / `UNSPECIFIED_SCHEMA_LABEL` not found.

- [ ] **Step 3: Implement `buildSchemaGroupedTree`**

Add to `dbt-tree-utils.ts`:

```typescript
export const UNSPECIFIED_SCHEMA_LABEL = 'Unspecified';

export function buildSchemaGroupedTree(
  pathTree: DbtTreeNode[],
  schemaByLineageNodeId: ReadonlyMap<string, string>,
): DbtTreeNode[] {
  const leaves = collectSelectableNodes(pathTree);
  const groups = new Map<string, DbtTreeNode[]>();

  for (const leaf of leaves) {
    const lineageId = leaf.lineageNodeId!;
    const raw = schemaByLineageNodeId.get(lineageId)?.trim() ?? '';
    const label = raw.length > 0 ? raw : UNSPECIFIED_SCHEMA_LABEL;
    const bucket = groups.get(label) ?? [];
    bucket.push({
      ...leaf,
      // Keep leaf identity for selection; path stays the dbt path for tooltips/filter.
    });
    groups.set(label, bucket);
  }

  const labels = [...groups.keys()].sort((a, b) => {
    if (a === UNSPECIFIED_SCHEMA_LABEL) return 1;
    if (b === UNSPECIFIED_SCHEMA_LABEL) return -1;
    return a.localeCompare(b);
  });

  return labels.map((label) => {
    const children = (groups.get(label) ?? []).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    return {
      id: `schema:${label}`,
      name: label,
      path: `schema:${label}`,
      type: 'folder' as const,
      children,
    };
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless --include='**/dbt-tree-utils.spec.ts'`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mds-ui/src/app/features/lineage/dbt-tree-utils.ts mds-ui/src/app/features/lineage/dbt-tree-utils.spec.ts
git commit -m "$(cat <<'EOF'
feat(ui): build schema-grouped dbt tree for panel toggle

EOF
)"
```

---

### Task 3: Folder ↔ schema toggle + localStorage prefs + consumer wiring

**Files:**
- Modify: `mds-ui/src/app/features/lineage/folder-search-panel/folder-search-panel.component.ts`
- Modify: `mds-ui/src/app/features/lineage/folder-search-panel/folder-search-panel.component.html`
- Modify: `mds-ui/src/app/features/lineage/folder-search-panel/folder-search-panel.component.scss`
- Modify: `mds-ui/src/app/features/lineage/lineage-page/lineage-page.component.html`
- Modify: `mds-ui/src/app/features/tables/table-hub-page/table-hub-page.component.html`
- Modify: `mds-ui/src/app/features/explorer/tables-workspace-page/tables-workspace-page.component.html`

**Interfaces:**
- Consumes: `buildSchemaGroupedTree`, `getDefaultExpandedPaths`, existing collapse/width localStorage pattern
- Produces (panel inputs):
  - `projectUuid = input<string | null>(null)`
  - `lineageNodes = input<LineageNode[]>([])`
  - Internal: `treeViewMode: signal<'folder' | 'schema'>`
  - Storage keys (when `projectUuid` set):
    - `${collapsedStorageKey()}:tree-view:${projectUuid}` → `'folder' | 'schema'`
    - `${collapsedStorageKey()}:expanded:${projectUuid}` → JSON string array of paths
  - Surface keys already differ (`lightdash-lineage-folder-panel-collapsed` vs `lightdash-tables-hub-folder-collapsed` vs `lightdash-tables-folder-panel-collapsed`) so Lineage vs Tables do not cross-contaminate.

- [ ] **Step 1: Add inputs, schema map, active tree, toggle**

In `folder-search-panel.component.ts`, add imports for `LineageNode`, `buildSchemaGroupedTree`, and:

```typescript
readonly projectUuid = input<string | null>(null);
readonly lineageNodes = input<LineageNode[]>([]);

protected readonly treeViewMode = signal<'folder' | 'schema'>('folder');

private readonly schemaByLineageNodeId = computed(() => {
  const map = new Map<string, string>();
  for (const node of this.lineageNodes()) {
    map.set(node.id, node.schema ?? '');
  }
  return map;
});

private readonly activeTree = computed(() => {
  if (this.treeViewMode() === 'schema') {
    return buildSchemaGroupedTree(this.tree(), this.schemaByLineageNodeId());
  }
  return this.tree();
});

protected readonly filteredTree = computed(() =>
  filterTreeNodes(this.activeTree(), this.searchQuery()),
);
```

Replace constructor effects that reset `expandedPaths` from `this.tree()` so they use `this.activeTree()` / `this.filteredTree()` instead.

Add toggle + persistence helpers:

```typescript
protected toggleTreeViewMode(): void {
  const next = this.treeViewMode() === 'folder' ? 'schema' : 'folder';
  this.treeViewMode.set(next);
  this.persistTreeViewMode(next);
  // Reset expand set for the new tree shape (prefer saved for this mode if present).
  const saved = this.readExpandedPaths();
  this.expandedPaths.set(
    saved ?? getDefaultExpandedPaths(this.activeTree()),
  );
  this.persistExpandedPaths(this.expandedPaths());
}

private viewModeStorageKey(): string | null {
  const projectUuid = this.projectUuid();
  if (!projectUuid || !isPlatformBrowser(this.platformId)) {
    return null;
  }
  return `${this.collapsedStorageKey()}:tree-view:${projectUuid}`;
}

private expandedStorageKey(): string | null {
  const projectUuid = this.projectUuid();
  if (!projectUuid || !isPlatformBrowser(this.platformId)) {
    return null;
  }
  return `${this.collapsedStorageKey()}:expanded:${projectUuid}`;
}

private readTreeViewMode(): 'folder' | 'schema' {
  const key = this.viewModeStorageKey();
  if (!key) {
    return 'folder';
  }
  const raw = localStorage.getItem(key);
  return raw === 'schema' ? 'schema' : 'folder';
}

private persistTreeViewMode(mode: 'folder' | 'schema'): void {
  const key = this.viewModeStorageKey();
  if (!key) {
    return;
  }
  localStorage.setItem(key, mode);
}

private readExpandedPaths(): Set<string> | null {
  const key = this.expandedStorageKey();
  if (!key) {
    return null;
  }
  const raw = localStorage.getItem(key);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || !parsed.every((p) => typeof p === 'string')) {
      return null;
    }
    return new Set(parsed);
  } catch {
    return null;
  }
}

private persistExpandedPaths(paths: Set<string>): void {
  const key = this.expandedStorageKey();
  if (!key) {
    return;
  }
  localStorage.setItem(key, JSON.stringify([...paths]));
}
```

Initialize in constructor:

```typescript
this.treeViewMode.set(this.readTreeViewMode());
```

Change the tree-load effect to:

```typescript
effect(() => {
  const tree = this.activeTree();
  const projectUuid = this.projectUuid();
  if (tree.length === 0) {
    return;
  }
  // Re-read when project changes.
  projectUuid;
  const saved = this.readExpandedPaths();
  this.expandedPaths.set(saved ?? getDefaultExpandedPaths(tree));
});
```

Update `toggleFolder` to call `persistExpandedPaths(next)` after mutating the set.

Ancestor-expand effect: use `this.activeTree()` instead of `this.tree()` so schema groups open correctly.

- [ ] **Step 2: Header toggle UI**

In `folder-search-panel.component.html`, inside `folder-panel__header` (after the title, before search), add:

```html
<button
  type="button"
  class="folder-panel__view-toggle"
  [attr.aria-label]="
    treeViewMode() === 'folder'
      ? 'Switch to schema view'
      : 'Switch to folder view'
  "
  [attr.title]="
    treeViewMode() === 'folder'
      ? 'Schema view'
      : 'Folder view'
  "
  (click)="toggleTreeViewMode()"
>
  <mat-icon>{{ treeViewMode() === 'folder' ? 'folder' : 'schema' }}</mat-icon>
  <mat-icon class="folder-panel__view-toggle-swap">swap_horiz</mat-icon>
  <mat-icon>{{ treeViewMode() === 'folder' ? 'schema' : 'folder' }}</mat-icon>
</button>
```

Style the toggle as a compact header control (`flex-shrink: 0`, `white-space: nowrap`, no overflow onto the page).

- [ ] **Step 3: Wire consumers**

`lineage-page.component.html`:

```html
<app-folder-search-panel
  [tree]="dbtTree()"
  [lineageNodes]="data.nodes"
  [projectUuid]="projectUuid()"
  [selectedNodeId]="selectedNodeId()"
  (nodeSelected)="onNodeSelected($event)"
/>
```

`table-hub-page.component.html` (panel already present; hub already has `lineage = signal<ProjectLineage | null>(null)`):

```html
[lineageNodes]="lineage()?.nodes ?? []"
[projectUuid]="projectUuid()"
```

`tables-workspace-page.component.html` — same two inputs. Workspace today loads only `getDbtTree` (no lineage nodes). Add a minimal lineage fetch **only** to supply `schema` for grouping; do not add a second panel or graph:

```typescript
protected readonly lineageNodes = signal<LineageNode[]>([]);
// in loadWorkspaceData (alongside getDbtTree):
this.lineageService.getProjectLineage(projectUuid).subscribe({
  next: (lineage) => this.lineageNodes.set(lineage.nodes),
  error: () => this.lineageNodes.set([]),
});
```

```html
[lineageNodes]="lineageNodes()"
[projectUuid]="projectUuid()"
```

- [ ] **Step 4: Manual smoke (no new component test required)**

In browser: toggle folder↔schema on Lineage; remount by navigating away and back; confirm view mode + expanded folders restore for that project key. Switch project UUID and confirm prefs do not bleed.

- [ ] **Step 5: Commit**

```bash
git add \
  mds-ui/src/app/features/lineage/folder-search-panel \
  mds-ui/src/app/features/lineage/lineage-page/lineage-page.component.html \
  mds-ui/src/app/features/tables/table-hub-page/table-hub-page.component.html \
  mds-ui/src/app/features/tables/table-hub-page/table-hub-page.component.ts \
  mds-ui/src/app/features/explorer/tables-workspace-page/tables-workspace-page.component.html \
  mds-ui/src/app/features/explorer/tables-workspace-page/tables-workspace-page.component.ts
git commit -m "$(cat <<'EOF'
feat(ui): add folder/schema tree toggle with per-project prefs

EOF
)"
```

---

### Task 4: Column type hint helper

**Files:**
- Create: `mds-ui/src/app/features/lineage/column-type-hint.utils.ts`
- Create: `mds-ui/src/app/features/lineage/column-type-hint.utils.spec.ts`

**Interfaces:**
- Produces: `columnTypeHint(type: string | null | undefined): '#' | 'Aa' | null`

- [ ] **Step 1: Write the failing test**

```typescript
import { columnTypeHint } from './column-type-hint.utils';

describe('columnTypeHint', () => {
  it('returns null when type is missing or blank', () => {
    expect(columnTypeHint(undefined)).toBeNull();
    expect(columnTypeHint(null)).toBeNull();
    expect(columnTypeHint('')).toBeNull();
    expect(columnTypeHint('   ')).toBeNull();
  });

  it('returns # for numeric-ish types', () => {
    expect(columnTypeHint('integer')).toBe('#');
    expect(columnTypeHint('INT64')).toBe('#');
    expect(columnTypeHint('numeric(18,2)')).toBe('#');
    expect(columnTypeHint('double precision')).toBe('#');
    expect(columnTypeHint('float')).toBe('#');
    expect(columnTypeHint('decimal')).toBe('#');
    expect(columnTypeHint('bigint')).toBe('#');
  });

  it('returns Aa for other non-empty types', () => {
    expect(columnTypeHint('varchar')).toBe('Aa');
    expect(columnTypeHint('text')).toBe('Aa');
    expect(columnTypeHint('boolean')).toBe('Aa');
    expect(columnTypeHint('timestamp')).toBe('Aa');
    expect(columnTypeHint('date')).toBe('Aa');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless --include='**/column-type-hint.utils.spec.ts'`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
const NUMERIC_TYPE_RE =
  /\b(int|integer|bigint|smallint|tinyint|float|double|real|decimal|numeric|number|money)\b/i;

export function columnTypeHint(
  type: string | null | undefined,
): '#' | 'Aa' | null {
  const normalized = type?.trim() ?? '';
  if (!normalized) {
    return null;
  }
  return NUMERIC_TYPE_RE.test(normalized) ? '#' : 'Aa';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless --include='**/column-type-hint.utils.spec.ts'`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add \
  mds-ui/src/app/features/lineage/column-type-hint.utils.ts \
  mds-ui/src/app/features/lineage/column-type-hint.utils.spec.ts
git commit -m "$(cat <<'EOF'
feat(ui): add column type hint helper for lineage cards

EOF
)"
```

---

### Task 5: Manual neighborhood expand utils

**Files:**
- Create: `mds-ui/src/app/features/lineage/lineage-neighborhood-utils.ts`
- Create: `mds-ui/src/app/features/lineage/lineage-neighborhood-utils.spec.ts`

**Interfaces:**
- Consumes: `LineageEdge`, `getDirectUpstreamIds`, `getDirectDownstreamIds` from `lineage-focus-utils.ts`
- Produces:

```typescript
export type NeighborhoodSide = 'upstream' | 'downstream';

export interface ManualNeighborhoodExpansion {
  fromNodeId: string;
  side: NeighborhoodSide;
  neighborIds: readonly string[];
}

export interface ManualNeighborhoodState {
  expansions: readonly ManualNeighborhoodExpansion[];
}

export function emptyManualNeighborhood(): ManualNeighborhoodState;
export function isNeighborhoodSideExpanded(
  state: ManualNeighborhoodState,
  nodeId: string,
  side: NeighborhoodSide,
): boolean;
export function toggleNeighborhoodSide(
  state: ManualNeighborhoodState,
  nodeId: string,
  side: NeighborhoodSide,
  edges: LineageEdge[],
): ManualNeighborhoodState;
export function collectManualNeighborIds(
  state: ManualNeighborhoodState,
): Set<string>;
export function unionHopAndManualIds(
  hopWindow: ReadonlySet<string> | null,
  state: ManualNeighborhoodState,
): Set<string> | null;
export function hasDirectNeighbors(
  nodeId: string,
  side: NeighborhoodSide,
  edges: LineageEdge[],
): boolean;
```

Collapse semantics: removing an expansion entry means those neighbors disappear from `collectManualNeighborIds` unless another expansion still lists them; `unionHopAndManualIds` then keeps them if still in the hop window.

- [ ] **Step 1: Write the failing tests**

```typescript
import { LineageEdge } from '../../core/models/lineage.model';
import {
  collectManualNeighborIds,
  emptyManualNeighborhood,
  hasDirectNeighbors,
  isNeighborhoodSideExpanded,
  toggleNeighborhoodSide,
  unionHopAndManualIds,
} from './lineage-neighborhood-utils';

const edges: LineageEdge[] = [
  { source: 'a', target: 'b' },
  { source: 'b', target: 'c' },
  { source: 'b', target: 'd' },
];

describe('lineage-neighborhood-utils', () => {
  it('expands one hop upstream without duplicating', () => {
    let state = emptyManualNeighborhood();
    state = toggleNeighborhoodSide(state, 'b', 'upstream', edges);
    expect(isNeighborhoodSideExpanded(state, 'b', 'upstream')).toBeTrue();
    expect([...collectManualNeighborIds(state)].sort()).toEqual(['a']);

    state = toggleNeighborhoodSide(state, 'b', 'upstream', edges);
    expect(isNeighborhoodSideExpanded(state, 'b', 'upstream')).toBeFalse();
    expect(collectManualNeighborIds(state).size).toBe(0);
  });

  it('expands one hop downstream', () => {
    let state = emptyManualNeighborhood();
    state = toggleNeighborhoodSide(state, 'b', 'downstream', edges);
    expect([...collectManualNeighborIds(state)].sort()).toEqual(['c', 'd']);
  });

  it('no-ops when side has no direct neighbors', () => {
    const state = toggleNeighborhoodSide(
      emptyManualNeighborhood(),
      'a',
      'upstream',
      edges,
    );
    expect(state.expansions).toEqual([]);
    expect(hasDirectNeighbors('a', 'upstream', edges)).toBeFalse();
    expect(hasDirectNeighbors('a', 'downstream', edges)).toBeTrue();
  });

  it('keeps a neighbor if another expansion still requires it', () => {
    let state = emptyManualNeighborhood();
    state = toggleNeighborhoodSide(state, 'c', 'upstream', edges); // adds b
    state = toggleNeighborhoodSide(state, 'd', 'upstream', edges); // adds b
    state = toggleNeighborhoodSide(state, 'c', 'upstream', edges); // remove c's expand
    expect([...collectManualNeighborIds(state)]).toEqual(['b']);
  });

  it('unions hop window with manual neighbors; null hop stays null (full/no selection)', () => {
    let state = emptyManualNeighborhood();
    state = toggleNeighborhoodSide(state, 'b', 'downstream', edges);
    expect(unionHopAndManualIds(null, state)).toBeNull();

    const hop = new Set(['b']);
    const visible = unionHopAndManualIds(hop, state)!;
    expect([...visible].sort()).toEqual(['b', 'c', 'd']);
  });

  it('after collapse, hop window still keeps nodes that were only manually added if hop covers them', () => {
    let state = emptyManualNeighborhood();
    state = toggleNeighborhoodSide(state, 'b', 'downstream', edges);
    state = toggleNeighborhoodSide(state, 'b', 'downstream', edges);
    const hop = new Set(['b', 'c']);
    expect([...unionHopAndManualIds(hop, state)!].sort()).toEqual(['b', 'c']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless --include='**/lineage-neighborhood-utils.spec.ts'`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `lineage-neighborhood-utils.ts`:

```typescript
import { LineageEdge } from '../../core/models/lineage.model';
import {
  getDirectDownstreamIds,
  getDirectUpstreamIds,
} from './lineage-focus-utils';

export type NeighborhoodSide = 'upstream' | 'downstream';

export interface ManualNeighborhoodExpansion {
  fromNodeId: string;
  side: NeighborhoodSide;
  neighborIds: readonly string[];
}

export interface ManualNeighborhoodState {
  expansions: readonly ManualNeighborhoodExpansion[];
}

export function emptyManualNeighborhood(): ManualNeighborhoodState {
  return { expansions: [] };
}

export function hasDirectNeighbors(
  nodeId: string,
  side: NeighborhoodSide,
  edges: LineageEdge[],
): boolean {
  const ids =
    side === 'upstream'
      ? getDirectUpstreamIds(nodeId, edges)
      : getDirectDownstreamIds(nodeId, edges);
  return ids.length > 0;
}

export function isNeighborhoodSideExpanded(
  state: ManualNeighborhoodState,
  nodeId: string,
  side: NeighborhoodSide,
): boolean {
  return state.expansions.some(
    (expansion) => expansion.fromNodeId === nodeId && expansion.side === side,
  );
}

export function toggleNeighborhoodSide(
  state: ManualNeighborhoodState,
  nodeId: string,
  side: NeighborhoodSide,
  edges: LineageEdge[],
): ManualNeighborhoodState {
  if (isNeighborhoodSideExpanded(state, nodeId, side)) {
    return {
      expansions: state.expansions.filter(
        (expansion) =>
          !(expansion.fromNodeId === nodeId && expansion.side === side),
      ),
    };
  }

  const neighborIds =
    side === 'upstream'
      ? getDirectUpstreamIds(nodeId, edges)
      : getDirectDownstreamIds(nodeId, edges);

  if (neighborIds.length === 0) {
    return state;
  }

  return {
    expansions: [
      ...state.expansions,
      { fromNodeId: nodeId, side, neighborIds: [...neighborIds] },
    ],
  };
}

export function collectManualNeighborIds(
  state: ManualNeighborhoodState,
): Set<string> {
  const ids = new Set<string>();
  for (const expansion of state.expansions) {
    for (const neighborId of expansion.neighborIds) {
      ids.add(neighborId);
    }
  }
  return ids;
}

export function unionHopAndManualIds(
  hopWindow: ReadonlySet<string> | null,
  state: ManualNeighborhoodState,
): Set<string> | null {
  if (hopWindow === null) {
    return null;
  }
  const manual = collectManualNeighborIds(state);
  if (manual.size === 0) {
    return new Set(hopWindow);
  }
  const next = new Set(hopWindow);
  for (const id of manual) {
    next.add(id);
  }
  return next;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless --include='**/lineage-neighborhood-utils.spec.ts'`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add \
  mds-ui/src/app/features/lineage/lineage-neighborhood-utils.ts \
  mds-ui/src/app/features/lineage/lineage-neighborhood-utils.spec.ts
git commit -m "$(cat <<'EOF'
feat(ui): add manual one-hop neighborhood expand utils

EOF
)"
```

---

### Task 6: Wire neighborhood into `lineage-graph` (Focus ∪ manual, no recenter)

**Files:**
- Modify: `mds-ui/src/app/features/lineage/lineage-graph/lineage-graph.component.ts`

**Interfaces:**
- Consumes: `emptyManualNeighborhood`, `toggleNeighborhoodSide`, `unionHopAndManualIds`, `isNeighborhoodSideExpanded`, `hasDirectNeighbors`
- Produces (component methods):
  - `protected readonly manualNeighborhood = signal(emptyManualNeighborhood())`
  - `protected toggleNeighborhood(nodeId: string, side: NeighborhoodSide, event: Event): void`
  - `protected isNeighborhoodExpanded(nodeId: string, side: NeighborhoodSide): boolean`
  - `protected canToggleNeighborhood(nodeId: string, side: NeighborhoodSide): boolean`
  - Updated `displayNodes` / `displayEdges` to use hop ∪ manual in Focus mode
  - Effect: reset `manualNeighborhood` when `selectedNodeId()` changes to a different id
  - Fit-to-view effect must **not** depend on `manualNeighborhood` / must not call fit solely because −/+ changed `displayNodes`

- [ ] **Step 1: Add state + helpers**

Near other signals in `lineage-graph.component.ts`:

```typescript
protected readonly manualNeighborhood = signal(emptyManualNeighborhood());
private lastFocusRootId: string | null = null;
```

Replace `displayNodes` / `displayEdges`:

```typescript
protected readonly displayNodes = computed(() => {
  if (this.graphMode() === 'full') {
    return this.nodes();
  }
  const related = this.relatedNodeIds();
  const visibleIds = unionHopAndManualIds(related, this.manualNeighborhood());
  if (!visibleIds) {
    return this.nodes();
  }
  return this.nodes().filter((node) => visibleIds.has(node.id));
});

protected readonly displayEdges = computed(() => {
  if (this.graphMode() === 'full') {
    return this.edges();
  }
  const related = this.relatedNodeIds();
  const visibleIds = unionHopAndManualIds(related, this.manualNeighborhood());
  if (!visibleIds) {
    return this.edges();
  }
  return this.edges().filter((edge) => isEdgeInSubgraph(edge, visibleIds));
});
```

Add methods:

```typescript
protected toggleNeighborhood(
  nodeId: string,
  side: NeighborhoodSide,
  event: Event,
): void {
  event.stopPropagation();
  event.preventDefault();
  this.manualNeighborhood.set(
    toggleNeighborhoodSide(
      this.manualNeighborhood(),
      nodeId,
      side,
      this.edges(),
    ),
  );
  // Intentionally do not call scheduleFitToView / scheduleCenterOnNode.
}

protected isNeighborhoodExpanded(
  nodeId: string,
  side: NeighborhoodSide,
): boolean {
  return isNeighborhoodSideExpanded(
    this.manualNeighborhood(),
    nodeId,
    side,
  );
}

protected canToggleNeighborhood(
  nodeId: string,
  side: NeighborhoodSide,
): boolean {
  return hasDirectNeighbors(nodeId, side, this.edges());
}
```

- [ ] **Step 2: Reset on focus root change**

Add effect in constructor:

```typescript
effect(() => {
  const focusRoot = this.selectedNodeId();
  if (focusRoot !== this.lastFocusRootId) {
    this.lastFocusRootId = focusRoot;
    this.manualNeighborhood.set(emptyManualNeighborhood());
  }
});
```

- [ ] **Step 3: Stop auto-fit on manual-only changes**

Find the existing fit effect (today it reads `displayNodes()` / `displayEdges()`). Change it so it tracks structural inputs only:

```typescript
effect(() => {
  this.nodes();
  this.edges();
  this.relatedNodeIds();
  this.graphMode();
  this.viewMode();
  this.hopDepth();
  // Do not read manualNeighborhood() or displayNodes() here — −/+ must not fit.
  if (!this.selectedColumn()) {
    this.scheduleFitToView();
  }
});
```

Keep the separate `selectedNodeId` → `scheduleCenterOnNode` effect as-is (selection changes still center; −/+ does not change selection).

- [ ] **Step 4: Sanity-check Full-mode dimming**

`isNodeDimmed` in Full mode uses `relatedNodeIds()` (hop window), not `displayNodes`. Leave that behavior: −/+ does not undim the whole graph in Full; it only matters for Focus visibility + collapse bookkeeping. Do not change `NODE_COLORS`.

- [ ] **Step 5: Commit**

```bash
git add mds-ui/src/app/features/lineage/lineage-graph/lineage-graph.component.ts
git commit -m "$(cat <<'EOF'
feat(ui): union focus hop window with manual neighborhood expands

EOF
)"
```

---

### Task 7: Model card chrome (header / columns / footer) + heights

**Files:**
- Modify: `mds-ui/src/app/features/lineage/lineage-column-utils.ts`
- Modify: `mds-ui/src/app/features/lineage/lineage-column-utils.spec.ts` (update height expectations if constants change)
- Modify: `mds-ui/src/app/features/lineage/lineage-layout.ts`
- Modify: `mds-ui/src/app/features/lineage/lineage-graph/lineage-graph.component.ts`
- Modify: `mds-ui/src/app/features/lineage/lineage-graph/lineage-graph.component.html`
- Modify: `mds-ui/src/app/features/lineage/lineage-graph/lineage-graph.component.scss`

**Interfaces:**
- Height constants:
  - `LINEAGE_NODE_HEADER_HEIGHT` — header only (type icon + name + “N columns” + chevron); retune from 72 if the new header is shorter (target ~56)
  - `LINEAGE_NODE_FOOTER_HEIGHT = 28` — −/+ strip always present on model cards
  - Collapsed card height = `HEADER + FOOTER`
  - Expanded = `HEADER + columnBody + FOOTER`
- Column expand control becomes a **chevron** (not +/−); +/− move to footer for neighborhood
- `nodeMetaLabel` / schema line in header: replace with `columnCountLabel(node) => \`${node.columnCount} columns\``
- Type affordance: keep colored fill/stroke via `NODE_COLORS`; replace text type badge with a compact type icon glyph (SVG text or short badge using first letter is fine) — do **not** change fill/stroke/badge color hex values in `NODE_COLORS`
- `columnTypeHint` shown left of column name only when non-null
- Empty columns: show `0 columns`; chevron disabled / no-op (`nodeHasExpandButton` already false when no columns — keep that)
- Wide columns: existing clipPath + wheel scroll stays; ensure SCSS does not set widths that grow the page shell

- [ ] **Step 1: Update height helpers (TDD)**

In `lineage-column-utils.ts`:

```typescript
export const LINEAGE_NODE_HEADER_HEIGHT = 56;
export const LINEAGE_NODE_FOOTER_HEIGHT = 28;
// keep LINEAGE_COLUMN_ROW_HEIGHT, MAX_VISIBLE, BODY_PADDING

export function getCollapsedNodeHeight(): number {
  return LINEAGE_NODE_HEADER_HEIGHT + LINEAGE_NODE_FOOTER_HEIGHT;
}

export function getExpandedNodeHeight(node: LineageNode): number {
  const columnCount = node.columns?.length ?? 0;
  if (columnCount === 0) {
    return getCollapsedNodeHeight();
  }
  return (
    LINEAGE_NODE_HEADER_HEIGHT +
    getColumnBodyHeight(columnCount) +
    LINEAGE_NODE_FOOTER_HEIGHT
  );
}
```

Update `lineage-layout.ts` `nodeHeight`:

```typescript
function nodeHeight(
  node: LineageNode,
  viewMode: LineageViewMode,
  expandedNodeIds: ReadonlySet<string>,
): number {
  const expanded =
    (viewMode === 'columns' || expandedNodeIds.has(node.id)) &&
    !!node.columns?.length;
  if (expanded) {
    return getExpandedNodeHeight(node);
  }
  return getCollapsedNodeHeight();
}
```

Import `getCollapsedNodeHeight` from `lineage-column-utils`.

Update `lineage-column-utils.spec.ts` expectations to use the new collapsed/expanded formulas (same structural asserts: tall capped at max visible; short < tall).

Run: `cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless --include='**/lineage-column-utils.spec.ts'`

Expected: PASS after updates.

- [ ] **Step 2: Component helpers**

In `lineage-graph.component.ts`:

```typescript
import { columnTypeHint } from '../column-type-hint.utils';
import {
  LINEAGE_NODE_FOOTER_HEIGHT,
  // existing imports...
} from '../lineage-column-utils';

protected columnCountLabel(node: LineageNode): string {
  const n = node.columnCount ?? node.columns?.length ?? 0;
  return `${n} column${n === 1 ? '' : 's'}`;
}

protected typeHintForColumn(column: LineageColumn): '#' | 'Aa' | null {
  return columnTypeHint(column.type);
}

protected footerHeight(): number {
  return LINEAGE_NODE_FOOTER_HEIGHT;
}

protected typeIconGlyph(type: string): string {
  switch (type) {
    case 'source':
      return 'Src';
    case 'seed':
      return 'Seed';
    case 'staging':
      return 'S';
    case 'intermediate':
      return 'I';
    case 'mart':
      return 'M';
    default:
      return '?';
  }
}
```

Draw these short labels in the existing badge rect, **reusing `nodeColors(type).badge`** (and existing `typeBadgeWidth` sizing). Do not invent new hex colors. No emoji glyphs.

Keep `toggleNodeExpand` for the chevron (stopPropagation already present). Ensure column mode still auto-expands via the existing `viewMode === 'columns'` effect.

- [ ] **Step 3: Rewrite node SVG regions**

In `lineage-graph.component.html`, for each node group:

1. **Header** (`lineage-graph__node-header`):
   - Keep drag handle.
   - Type badge/icon using existing badge fill.
   - Name `foreignObject`.
   - Meta line: `{{ columnCountLabel(node) }}` (not schema · cols).
   - Replace expand `+`/`−` control with chevron:

```html
@if (nodeHasExpandButton(node)) {
  <g
    class="lineage-graph__chevron-btn"
    [attr.transform]="'translate(' + (pos.width - 28) + ', 10)'"
    (click)="toggleNodeExpand(node.id, $event)"
    (pointerdown)="$event.stopPropagation()"
    (pointerup)="$event.stopPropagation()"
    role="button"
    tabindex="0"
    [attr.aria-label]="isNodeExpanded(node.id) ? 'Collapse columns' : 'Expand columns'"
  >
    <rect width="18" height="18" rx="4" fill="rgba(255,255,255,0.85)" stroke="var(--ld-gray-4)" />
    <text x="9" y="13" text-anchor="middle" class="lineage-graph__expand-icon">
      {{ isNodeExpanded(node.id) ? '▾' : '▸' }}
    </text>
  </g>
}
```

2. **Body**: keep column rows; add type hint text before name when `typeHintForColumn(col)` is non-null:

```html
@if (typeHintForColumn(col); as hint) {
  <text class="lineage-graph__column-type-hint" x="28" [attr.y]="columnRowHeight() / 2 + 4">{{ hint }}</text>
  <text class="lineage-graph__column-name" x="48" [attr.y]="columnRowHeight() / 2 + 4">{{ col.name }}</text>
} @else {
  <text class="lineage-graph__column-name" x="28" [attr.y]="columnRowHeight() / 2 + 4">{{ col.name }}</text>
}
```

Adjust transform-chip X if needed so hints do not collide (reuse `transformChipX` with a slightly smaller name width).

3. **Footer** (always, below body or below header when collapsed):

```html
<g
  class="lineage-graph__node-footer"
  [attr.transform]="'translate(0, ' + (pos.height - footerHeight()) + ')'"
>
  <line
    class="lineage-graph__node-divider"
    x1="8"
    [attr.x2]="pos.width - 8"
    y1="0"
    y2="0"
  />
  <g
    class="lineage-graph__hop-btn"
    [class.lineage-graph__hop-btn--disabled]="!canToggleNeighborhood(node.id, 'upstream')"
    [class.lineage-graph__hop-btn--active]="isNeighborhoodExpanded(node.id, 'upstream')"
    transform="translate(12, 4)"
    (click)="canToggleNeighborhood(node.id, 'upstream') && toggleNeighborhood(node.id, 'upstream', $event)"
    (pointerdown)="$event.stopPropagation()"
    (pointerup)="$event.stopPropagation()"
    role="button"
    [attr.aria-disabled]="!canToggleNeighborhood(node.id, 'upstream')"
    [attr.aria-label]="'Toggle upstream neighbors for ' + node.name"
  >
    <rect width="22" height="20" rx="4" />
    <text x="11" y="14" text-anchor="middle">−</text>
  </g>
  <g
    class="lineage-graph__hop-btn"
    [class.lineage-graph__hop-btn--disabled]="!canToggleNeighborhood(node.id, 'downstream')"
    [class.lineage-graph__hop-btn--active]="isNeighborhoodExpanded(node.id, 'downstream')"
    [attr.transform]="'translate(' + (pos.width - 34) + ', 4)'"
    (click)="canToggleNeighborhood(node.id, 'downstream') && toggleNeighborhood(node.id, 'downstream', $event)"
    (pointerdown)="$event.stopPropagation()"
    (pointerup)="$event.stopPropagation()"
    role="button"
    [attr.aria-disabled]="!canToggleNeighborhood(node.id, 'downstream')"
    [attr.aria-label]="'Toggle downstream neighbors for ' + node.name"
  >
    <rect width="22" height="20" rx="4" />
    <text x="11" y="14" text-anchor="middle">+</text>
  </g>
</g>
```

Update column clipPath `y` / height math so the body sits between header and footer (`headerHeight()` … `pos.height - footerHeight()`). Reuse `columnBodyContentHeight(node)` for the scrollable region height.

- [ ] **Step 4: SCSS**

- Style footer hop buttons; disabled = lower opacity + `pointer-events: none` (also guard in click handler).
- Active (expanded side) = slightly stronger border using existing gray/stroke tokens — not new palette colors for node fill.
- `.lineage-graph__column-type-hint` muted, fixed width, no wrap.
- Ensure `.lineage-graph` canvas / page shells keep `overflow-x: clip|hidden` and `min-width: 0` as elsewhere; column overflow stays inside clipPath.

- [ ] **Step 5: Run related unit tests**

Run:

```bash
cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless --include='**/lineage-column-utils.spec.ts'
cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless --include='**/lineage-neighborhood-utils.spec.ts'
cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless --include='**/column-type-hint.utils.spec.ts'
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add \
  mds-ui/src/app/features/lineage/lineage-column-utils.ts \
  mds-ui/src/app/features/lineage/lineage-column-utils.spec.ts \
  mds-ui/src/app/features/lineage/lineage-layout.ts \
  mds-ui/src/app/features/lineage/lineage-graph
git commit -m "$(cat <<'EOF'
feat(ui): restyle lineage nodes as cards with chevron and hop footer

EOF
)"
```

---

### Task 8: Cross-surface verification (Lineage + Tables, Chromium + Firefox)

**Files:**
- None required unless smoke finds a wiring bug (fix in the owning task’s files).

**Interfaces:**
- Consumes: completed Tasks 1–7
- Produces: checklist sign-off matching the spec Verification section

- [ ] **Step 1: Run full lineage-related unit tests**

```bash
cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless --include='**/dbt-tree-utils.spec.ts'
cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless --include='**/column-type-hint.utils.spec.ts'
cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless --include='**/lineage-neighborhood-utils.spec.ts'
cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless --include='**/lineage-column-utils.spec.ts'
cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless --include='**/column-transformation.utils.spec.ts'
```

Expected: all PASS.

- [ ] **Step 2: Manual checklist (Chromium)**

- [ ] Lineage + Tables hub (+ workspace if applicable): leaf counts, filter keeps ancestors, folder↔schema toggle.
- [ ] Schema groups use warehouse schema; missing → Unspecified; selection still by `lineageNodeId`.
- [ ] Expanded folders + view mode persist per project via localStorage across remount.
- [ ] Cards collapsed by default; chevron toggles columns only; fill/border/selection ring unchanged.
- [ ] Focus + hop: −/+ add one-hop neighbors without changing selection or auto-recenter; collapse removes only eligible manual neighbors.
- [ ] Full mode: −/+ still toggle expansion state; no focus change.
- [ ] Column lineage mode: card shell + existing edge/column highlight/dimming still correct.
- [ ] Long column lists scroll inside the card; **no horizontal page scroll**.

- [ ] **Step 3: Repeat critical graph/tree smoke in Firefox**

Same −/+, chevron, panel toggle, and overflow checks. Fix any Firefox-only flex/overflow issues in component SCSS (prefer structure/CSS over UA sniffing).

- [ ] **Step 4: Commit only if smoke required code fixes**

```bash
git add -u mds-ui/src/app/features/lineage mds-ui/src/app/features/tables mds-ui/src/app/features/explorer
git commit -m "$(cat <<'EOF'
fix(ui): address lineage card and tree polish smoke findings

EOF
)"
```

If no fixes were needed, skip the commit.

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|------------------|------|
| Tree descendant leaf counts | Task 1 |
| Clearer resource-type icons; colors unchanged | Task 1 |
| Folder ↔ schema toggle | Tasks 2–3 |
| Schema from `LineageNode.schema`; Unspecified | Task 2 |
| Filter keeps ancestors | Task 2 (reuses `filterTreeNodes`) |
| localStorage expand + view mode keyed by project (+ surface key) | Task 3 |
| Shared on Lineage + Tables hub/workspace | Task 3 |
| Card header / body / footer | Task 7 |
| Columns collapsed by default; chevron only | Task 7 (+ existing `expandedNodeIds`) |
| Type hints only when type present | Tasks 4 + 7 |
| −/+ one-hop; no focus change; no auto-recenter | Tasks 5–6 |
| Focus = hop ∪ manual; collapse eligibility | Task 5 |
| Reset manual on focus root change; keep across mode/hop | Task 6 |
| Keep NODE_COLORS | Tasks 6–7 (explicit non-change) |
| Column lineage mode preserved | Task 7 (shell only) |
| Chromium/Firefox; no page horizontal scroll | Task 8 |
| No backend / no tab rename / no colibri rewrite | Global Constraints |

**Placeholder scan:** none intentionally left (no TBD / “similar to Task N” / “implement later”).

**Type consistency:** `ManualNeighborhoodState`, `NeighborhoodSide`, `UNSPECIFIED_SCHEMA_LABEL`, `treeViewMode: 'folder' | 'schema'`, storage key suffixes `:tree-view:` / `:expanded:` used consistently across tasks.

**Split decision:** utils extracted (`lineage-neighborhood-utils`, `column-type-hint.utils`); SVG remains in `lineage-graph` to avoid a risky mid-feature template split of a 550-line HTML file.

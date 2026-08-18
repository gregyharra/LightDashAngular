# Explore page and unlimited chart/explore export

**Date:** 2026-08-18  
**Status:** Accepted — implementation plan in `docs/superpowers/plans/2026-08-18-explore-and-chart-export.md`  
**Branch:** `feature/chart-data-export`  
**Related:** async warehouse queries (`docs/superpowers/specs/2026-07-31-async-warehouse-queries-design.md`); chart view page; health `query.csvMaxLimit`

## Problem

Users can run a metric query on the chart page, but they cannot download the result set. The on-screen query is capped by the chart row limit (default 500, max `query.maxLimit`, currently 1M). There is also no data-first Explore surface: **New → Chart** and **Metrics** go straight to `/charts/new`, so visualization and querying are the same page.

We need:

1. A dedicated **Explore** page (filters, results, SQL — no chart).
2. **Create chart from data** from Explore into chart create mode.
3. **CSV and Excel export** from Explore and the chart page, ignoring the chart row limit, without slowing interactive queries for this or other users.

## Goals

1. Add Explore at `/projects/:projectUuid/explore` (table picker) and `/projects/:projectUuid/explore/:tableId`.
2. Make Explore the data entry point: navbar **New → Chart** becomes **Explore data**; **Metrics** opens Explore. Tables hub and lineage deep-link to `/explore/:tableId`.
3. **Create chart from data** opens `/charts/new` with the current metric query and **auto-runs** the display-limited query.
4. Export **CSV and Excel** from:
   - Explore header (after a successful run)
   - Chart **view** header (after results exist)
   - Chart **edit** Results panel (not the edit header)
5. Export ignores the chart/display row limit. Default cap is health `query.csvMaxLimit` (5 million rows). v1 includes an **override**: warn, confirm, then run with no SQL `LIMIT`.
6. Export is a **separate warehouse job** on a dedicated pool. Click starts a browser download immediately; a snackbar is the fallback if auto-save is blocked.

## Non-goals

- Dashboard tile export (the dashboard **Export** menu item stays disabled).
- Explorer pivot tables, scheduled emails, or Google Sheets.
- Celery/Redis durable jobs (same in-process model as metric queries).
- Changing on-screen row limits or `query.maxLimit`.
- Using health `query.csvCellsLimit` (currently a stub value of 100). v1 caps **rows** only via `csvMaxLimit`.
- Pixel-perfect Lightdash export UI.
- Replacing or routing `tables-workspace-page` (not on the app router). Explore is based on **chart view**, not that workspace.

## Decisions (locked)

| Decision | Choice |
|----------|--------|
| Formats | CSV and Excel (`.xlsx`) |
| Default export cap | `query.csvMaxLimit` (5,000,000 rows) |
| Override | v1: warn → confirm → no SQL `LIMIT` |
| Download UX | Auto-download on the Export click (browser download bar); snackbar fallback |
| Latency isolation | Separate export thread pool (1 worker); do not use the interactive 4-worker query pool |
| File storage | Temp files on disk, TTL 1 hour; not the interactive query row store |
| Explore vs chart UI | Shared query workspace extracted from chart view (fields, filters, results, SQL) |
| New chart entry | Explore first; `/charts/new` only from **Create chart from data** (or a pasted/empty URL) |
| Chart create handoff | Router navigation state + auto-run |
| Cell values in files | Formatted values, matching the results table |
| Empty successful run | Export allowed (header-only file) |

## Architecture

```text
Navbar / Tables / Lineage
        │
        ▼
   Explore page  ──Create chart from data──►  /charts/new (hydrate + auto-run)
        │                                           │
        │  Run query (display LIMIT)                │  Run query (display LIMIT)
        ▼                                           ▼
   Interactive query pool (4 workers)          Chart view / edit
        │                                           │
        │  Export CSV/XLSX                          │  Export (view header / edit Results)
        ▼                                           ▼
   POST /exports  →  export pool (1 worker)  →  temp file
        │
        └── GET /exports/:uuid/file  (wait + stream; started on click)
```

### Shared query workspace

Extract from `chart-view-page` into a reusable workspace used by Explore and Chart:

- Left field picker
- Filters
- Results table (paged, display-limited rows)
- SQL panel
- Run query + display row limit (`clampQueryLimit` / `query.maxLimit`)

Explore wraps that workspace and adds header actions (Run, Export, Create chart). Chart wraps it and adds the Chart panel / configure mode.

Display queries stay on `POST /projects/:id/query/metric-query` + poll. Export never writes into that result store, so the grid stays at the display limit.

### Routes and navigation

| From | To |
|------|----|
| **New → Explore data** (replaces New → Chart) | `/projects/:projectUuid/explore` |
| **Metrics** | `/projects/:projectUuid/explore` |
| Tables hub / lineage explore action | `/projects/:projectUuid/explore/:tableId` |
| Explore **Create chart from data** | `/projects/:projectUuid/charts/new` with metric query in navigation state |
| Saved chart | `/projects/:projectUuid/charts/:chartUuid` unchanged |

`/charts/new` remains a valid create URL. Refresh or a pasted URL with **no** navigation state is empty create (no auto-run), same as today.

Unknown or non-exploreable `:tableId`: error on Explore plus a way back to the picker.

### Export API

Reuse the async query pattern (fast POST, poll, separate download).

**`POST /projects/{projectUuid}/exports`**

Body:

- `metricQuery` — same shape as metric-query (explore, dimensions, metrics, filters, sorts, additional metrics, time travel). Display `limit` on this object is ignored for the warehouse export.
- `format` — `"csv"` \| `"xlsx"`
- `overrideRowCap` — boolean, default `false`

Behavior:

1. Validate/compile like metric-query (same explore, field, filter rules).
2. Effective SQL limit: health `csvMaxLimit` when `overrideRowCap` is false; **omit `LIMIT`** when true. Posted `metricQuery.limit` is not used for export SQL.
3. Create an export job (`pending`), submit to the **export** pool, return `{ exportUuid }` immediately.

**`GET /projects/{projectUuid}/exports/{exportUuid}`**

Returns `{ status: pending \| executing \| ready \| error, error?, truncated?, rowCount?, format? }`.

`truncated` is `true` when the job used the cap and the worker read exactly `csvMaxLimit` rows (treat as “likely more rows”; a result that is *exactly* 5 million rows may also show truncated). Override jobs always have `truncated: false`.

The UI reads `query.csvMaxLimit` from health (backend already sends it; frontend `HealthResults` must include it). The `limit` on the posted `metricQuery` is ignored for warehouse SQL; it exists only so the payload can reuse the metric-query schema.

**`GET /projects/{projectUuid}/exports/{exportUuid}/file`**

- If not ready: wait on the server (long-poll, ~60s chunks; client retries until ready, error, or a client timeout).
- If ready: stream the temp file with `Content-Disposition: attachment` and a stable filename (`{explore-or-chart-slug}.{csv|xlsx}`).
- If error/expired: 4xx with message (no file).

Auth/project access matches metric-query.

### Export worker

- Pool: `ThreadPoolExecutor(max_workers=1, thread_name_prefix="mds-export")`. Interactive `mds-query` pool stays at 4.
- Snapshot Trino credentials on the request thread (same rule as metric queries).
- Stream warehouse rows to a temp file. Do **not** load the full export into the metric-query store.
- CSV: UTF-8 with BOM optional for Excel friendliness; first row is field **labels**; subsequent rows are formatted values.
- XLSX: write-only streaming workbook (e.g. `xlsxwriter` or openpyxl write-only). Same headers and formatted values.
- On success: `status=ready`, `rowCount`, `truncated` as above.
- On failure: `status=error`, message for poll and `/file`.
- Delete files after **1 hour** (and after process restart they are gone with the in-memory job store — acceptable, same as today’s query store).

Compile change: metric SQL builder must support **omitting** `LIMIT` for override exports. Display/metric-query paths still always apply a limit.

## UI

### Explore

- Shell aligned with chart view: field picker, accordion **Filters**, **Results**, **SQL**. No Chart panel, no configure mode.
- No table selected: picker of exploreable models (same set as Tables hub). Selection navigates to `/explore/:tableId`.
- Header after a table is selected:
  - **Run query** (display row limit)
  - **Export** — menu CSV / Excel; enabled only after a successful run (including 0 rows)
  - **Create chart from data** — enabled when at least one dimension or metric is selected; does not require a prior run

### Chart

- **View:** Export in title-actions, next to Edit; enabled when results exist.
- **Edit:** Export on the Results panel toolbar. Header stays Run query / Configure / Save / Done.

### Export dialog

1. User picks CSV or Excel.
2. Dialog explains the 5 million row cap.
   - Primary: **Export** → `overrideRowCap: false`
   - Secondary: **Export all rows** → warning that it can be slow and heavy on the warehouse → confirm → `overrideRowCap: true`
3. Client `POST`s the job, then immediately starts `GET .../file` from that click (hidden iframe or `<a>` navigation to the same-origin download URL) so the browser download bar owns the wait.
4. Client also polls status for snackbars.

### Create chart from data

Navigation state carries: explore name, dimensions, metrics, filters, sorts, additional metrics, display row limit, time travel if set.

Chart create mode hydrates the workspace and **auto-runs** the display-limited query so the chart has data. Auto-run failure shows the usual query error; fields/filters remain hydrated.

## Error handling

| Situation | Behavior |
|-----------|----------|
| Export with no successful run | Control disabled |
| Cap dialog cancelled | No job |
| `POST` fails (compile, 404 explore, permissions) | Snackbar; no download |
| Job/warehouse/disk error | Poll `error`; snackbar; `/file` fails without a file |
| Auto-download blocked | Snackbar with **Download file** (user click on the same `/file` URL) |
| Hit 5M cap | Success + `truncated: true`; snackbar that the file is the first 5 million rows, with **Export all rows** (re-open override path) |
| Override huge result | No extra UI cap; warehouse/timeout surfaces as job error. Run query stays usable |
| Navigate away during export | Browser download continues; in-app snackbar skipped if the page is destroyed. File lives until TTL |
| Successful 0-row run | Header-only file |
| Create chart with no fields | Button disabled |
| `/charts/new` without state | Empty create, no auto-run |
| Bad `:tableId` | Explore error + back to picker |

A long export may only queue behind other **exports**, never behind interactive Run query.

## Testing

### Backend

- `POST /exports` returns `exportUuid` without waiting on Trino.
- Capped compile includes `LIMIT` = `csvMaxLimit`; override omits `LIMIT`.
- Worker writes CSV and XLSX with labels + formatted values; `/file` waits then streams `Content-Disposition`.
- `truncated` when capped run yields exactly `csvMaxLimit` rows.
- Job error → poll `error` and `/file` 4xx.
- Metric-query still uses the interactive pool; a blocked/stubbed export worker does not prevent Run query in tests.

Use fixtures / a fake Trino stream. Do not run multi-million-row warehouse tests.

### Frontend

- Explore routes, picker, `/explore/:tableId`, navbar New / Metrics → Explore.
- Tables/lineage deep-link to Explore for that model.
- Export disabled until a successful run; CSV/Excel → dialog → `POST` then `/file`.
- Chart view: Export in header. Chart edit: Export on Results only.
- Create chart from data hydrates `/charts/new` and auto-runs; refresh without state stays empty.
- Snackbar fallback and truncated “first 5 million rows” + Export all rows.

## Implementation order

One spec, sequenced so each step is testable:

1. Backend export jobs + `/file` (CSV then XLSX) with cap/override and separate pool.
2. Shared query workspace extraction (behavior-preserving chart page).
3. Explore page + nav/deep-links + Create chart from data (auto-run).
4. Chart page Export placements (view header, edit Results).
5. Dialog, auto-download, snackbar fallback / truncation.

## Open implementation details (not product questions)

- Exact long-poll vs retry loop on `/file` (must start from the user click).
- CSV BOM vs UTF-8 only (prefer BOM if Excel on Windows mangles headers in QA).
- Filename slug source (explore label vs chart name vs `export`).

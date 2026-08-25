# Task 6 report

## Status

DONE

## Commit

- `fb142c7 feat(i18n): translate lineage and remaining TypeScript UI strings`

## Work completed

- Migrated lineage page, graph controls, detail panel, folder search, legend,
  transformation chips, tooltips, and accessibility labels to ngx-translate.
- Preserved model names, column names, SQL, database/schema paths, and other
  backend or user-authored values as runtime data.
- Migrated the remaining chart and explorer TypeScript fallbacks, including
  query, load, field, project-tree, save, and untitled-chart messages.
- Added `ApiErrorService.queryErrorWarning` so the default query warning comes
  from `common.queryFailed`; retained the standalone helper with an explicit
  caller-provided fallback.
- Migrated the remaining project-link confirmation and explorer-list chrome
  found during the Task 6 inventory.
- Confirmed export number formatting uses `LanguageService.formatNumber` and
  that the owned literal `confirm`, `snackBar.open`, and `en-US`
  `toLocaleString` inventory is empty outside mocks.
- Added matching English and French catalog entries in lockstep.

## TDD

- Added `api-error.service.spec.ts` before the service method.
- RED: the focused test failed to compile because
  `ApiErrorService.queryErrorWarning` did not exist.
- GREEN: after implementing the translated fallback, the focused spec passed
  (`1/1`).
- Updated the folder-search component spec with a translate provider required
  by the newly translated standalone component.

## Verification

- `api-error.service.spec.ts`: 1 passed.
- `language.service.spec.ts`: 6 passed.
- `lineage-neighborhood-utils.spec.ts`: 7 passed.
- `column-transformation.utils.spec.ts`: 10 passed.
- `folder-search-panel.component.spec.ts`: 2 passed.
- Focused total: 26 passed, 0 failed.
- English/French JSON parsing and recursive key-tree comparison: passed,
  721 matching leaf keys.
- Required literal inventory and `git diff --check`: clean.
- `npx ng build`: passed.

## Self-review and concerns

- No Task 6 correctness concerns found.
- The successful production build retains pre-existing warnings for the
  initial bundle budget, lineage/dashboard style budgets, and an unused
  `TitleCasePipe`; these are outside this task.
- Navbar Help/Notifications/Settings toggle work was not touched.

## Review fixes

- Renamed the hyphenated lineage catalog leaves to `passThrough` and
  `joinKey` while preserving the backend enum values.
- Added one transformation type-to-catalog-key mapping and used it for chip,
  legend, and graph translation lookups.
- Made transformation chip labels and descriptions react to in-place language
  changes through `TranslatePipe`.
- Kept the create-chart default name derived from the active language until
  the user edits it; user-entered names remain unchanged on later switches.
- Migrated the remaining owned dashboard, chart-query, and tables-workspace
  English fallbacks to matching English/French catalog keys.

## Review-fix TDD and verification

- RED: the new focused tests failed to compile because
  `transformationTranslationKey` and `resolveChartDraftName` did not exist.
- `npx ng test --no-watch --browsers=ChromeHeadless
  --include='**/column-transformation.utils.spec.ts'
  --include='**/chart-draft-name.spec.ts'`: passed, 13/13.
- `npx ng test --no-watch --browsers=ChromeHeadless
  --include='**/language.service.spec.ts'`: passed, 6/6.
- `npx ng test --no-watch --browsers=ChromeHeadless
  --include='**/api-error.service.spec.ts'`: passed, 1/1.
- `npx tsc --noEmit -p tsconfig.app.json`: passed.
- `npx ng build`: passed with the pre-existing bundle/style budget and unused
  `TitleCasePipe` warnings.
- `git diff --check`: passed.

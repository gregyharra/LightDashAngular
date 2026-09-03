# Task 6 report

## Status

DONE

## Commit

- `feat(workspace): adopt Ld buttons on dashboard and chart view chrome`

## Work completed

- Kept both specialized title/action layouts because their edit/view modes,
  menus, breadcrumbs, and side panels do not map cleanly to `ld-page-header`.
- Wrapped dashboard header/content and chart content/error widths with wide
  `ld-page-frame` components.
- Migrated dashboard Edit, Save, Cancel, Refresh, and Fullscreen actions to
  `ld-button` / `ld-icon-button`.
- Migrated chart Edit, Configure, Save, Done, breadcrumb edit, and configure
  close actions to `ld-button` / `ld-icon-button`.
- Added focused component coverage for view and edit mode design-system chrome.

## TDD and verification

- RED: focused component tests failed on the missing page frames and Ld actions
  (4/4 failed for the expected missing chrome).
- GREEN: focused dashboard/chart component tests passed (4/4).
- Development Angular build passed.
- IDE lint diagnostics: no errors.
- `git diff --check`: passed.

## Concerns

- Menu-trigger actions remain Material: dashboard Add tile, Views, More, and
  chart Export. Keeping `matMenuTriggerFor` on the native Material buttons
  preserves trigger semantics; dashboard tab-menu controls are also outside
  the page-toolbar scope.
- The build retains one pre-existing unused-import warning in
  `TableHubPageComponent`; the dashboard warning found during verification was
  removed.

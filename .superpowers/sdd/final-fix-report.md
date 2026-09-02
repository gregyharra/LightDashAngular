# Final whole-branch review fixes

## Status

DONE

## Work completed

- Added semantic on-brand and AI color tokens and mapped Material on-primary to
  the on-brand token.
- Restored white text for filled primary buttons.
- Restored the shell brand mark dimensions, wordmark typography, truncation,
  and navy/near-black color roles.
- Restored the circular bordered icon-button chrome, 18px icon sizing, hover
  treatment, and purple AI tone.
- Set the shared page-header title to the app header scale and added an optional
  brand title tone, used by the projects explore view.
- Prevented projected action-cluster controls from wrapping.
- Removed the accidental empty `wrote ` directory tree from the repository root.

## TDD and verification

- RED: focused design-system tests failed for all reviewed visual regressions
  (6 failed, 16 passed).
- GREEN: focused design-system tests passed (22/22).
- Required combined Angular suite passed (37/37).
- IDE lint diagnostics: no errors.
- `git diff --check`: passed.

## Concerns

- None.

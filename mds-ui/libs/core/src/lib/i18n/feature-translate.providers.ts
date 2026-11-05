import { Provider } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { provideChildTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';

/**
 * Feature catalogs live in `/assets/i18n/{feature}/{lang}.json` and are merged
 * on top of the root catalog (`/assets/i18n/{lang}.json`). The child service
 * delegates `use()` / language changes to the root `TranslateService` (owned by
 * `LanguageService`) and falls back to the root catalog per key.
 *
 * `MatDialog` is re-provided so dialogs opened from the feature create their
 * overlay content from the feature injector (otherwise they would resolve the
 * root `TranslateService` and miss feature-only keys).
 */
export type TranslateFeature =
  | 'ai'
  | 'auth'
  | 'charts'
  | 'dashboards'
  | 'lineage'
  | 'projects'
  | 'tables'
  | 'warehouses';

export function provideFeatureTranslations(feature: TranslateFeature): Provider[] {
  return [
    provideChildTranslateService({
      loader: provideTranslateHttpLoader({
        prefix: `/assets/i18n/${feature}/`,
        suffix: '.json',
      }),
    }),
    MatDialog,
  ];
}

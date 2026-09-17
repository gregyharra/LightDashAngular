import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { provideEffects } from '@ngrx/effects';
import { provideState } from '@ngrx/store';
import { APP_DATA_INVALIDATOR } from '@mds-ui/core';
import { ChartQueryEffects } from './chart-query.effects';
import { ChartQueryFacade } from './chart-query.facade';
import { chartQueryFeature } from './chart-query.reducer';

export function provideChartQueryState(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideState(chartQueryFeature),
    provideEffects(ChartQueryEffects),
    {
      provide: APP_DATA_INVALIDATOR,
      useExisting: ChartQueryFacade,
    },
  ]);
}

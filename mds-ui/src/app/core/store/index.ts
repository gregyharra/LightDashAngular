import { EnvironmentProviders } from '@angular/core';
import { provideEffects } from '@ngrx/effects';
import { provideStore } from '@ngrx/store';
import { ChartQueryEffects } from './chart-query/chart-query.effects';
import { chartQueryFeature } from './chart-query/chart-query.reducer';

export function provideAppStore(): EnvironmentProviders[] {
  return [
    provideStore({ [chartQueryFeature.name]: chartQueryFeature.reducer }),
    provideEffects(ChartQueryEffects),
  ];
}

export * from './chart-query/chart-query.actions';
export * from './chart-query/chart-query.models';
export * from './chart-query/chart-query.selectors';
export * from './chart-query/chart-query.utils';

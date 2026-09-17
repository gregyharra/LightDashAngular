import { TestBed } from '@angular/core/testing';
import { ExplorerPageFacade } from './explorer-page.facade';
import { ChartQueryFacade, ExplorerService } from '@mds-ui/feature-chart-query';

describe('ExplorerPageFacade', () => {
  it('is creatable', () => {
    TestBed.configureTestingModule({
      providers: [
        ExplorerPageFacade,
        { provide: ChartQueryFacade, useValue: {} },
        { provide: ExplorerService, useValue: {} },
      ],
    });
    expect(TestBed.inject(ExplorerPageFacade)).toBeTruthy();
  });
});

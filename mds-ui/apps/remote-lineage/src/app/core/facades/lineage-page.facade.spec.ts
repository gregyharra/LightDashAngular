import { TestBed } from '@angular/core/testing';
import { LineagePageFacade } from './lineage-page.facade';
import { LineageService } from '@mds-ui/feature-projects';

describe('LineagePageFacade', () => {
  it('is creatable', () => {
    TestBed.configureTestingModule({
      providers: [
        LineagePageFacade,
        { provide: LineageService, useValue: {} },
      ],
    });
    expect(TestBed.inject(LineagePageFacade)).toBeTruthy();
  });
});

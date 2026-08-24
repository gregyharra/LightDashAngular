import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { LightdashApiService } from '../../core/api/lightdash-api.service';
import { ModelJoinsService } from './model-joins.service';

describe('ModelJoinsService', () => {
  let service: ModelJoinsService;
  let apiGet: jasmine.Spy;

  beforeEach(() => {
    apiGet = jasmine.createSpy('get').and.returnValue(of([]));

    TestBed.configureTestingModule({
      providers: [
        ModelJoinsService,
        {
          provide: LightdashApiService,
          useValue: { get: apiGet },
        },
      ],
    });

    service = TestBed.inject(ModelJoinsService);
  });

  it('lists all project joins without a filter', () => {
    service.list('project-uuid').subscribe();

    expect(apiGet).toHaveBeenCalledWith('/projects/project-uuid/model-joins');
  });

  it('filters joins by source model for Table Hub', () => {
    service
      .list('project-uuid', 'model.test.dim_customers')
      .subscribe();

    expect(apiGet).toHaveBeenCalledWith(
      '/projects/project-uuid/model-joins?sourceModelId=model.test.dim_customers',
    );
  });

  it('encodes source model ids in the query string', () => {
    service.list('project-uuid', 'model/with space').subscribe();

    expect(apiGet).toHaveBeenCalledWith(
      '/projects/project-uuid/model-joins?sourceModelId=model%2Fwith%20space',
    );
  });
});

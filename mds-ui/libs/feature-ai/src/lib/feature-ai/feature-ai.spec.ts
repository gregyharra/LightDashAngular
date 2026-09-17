import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FeatureAi } from './feature-ai';

describe('FeatureAi', () => {
  let component: FeatureAi;
  let fixture: ComponentFixture<FeatureAi>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeatureAi]
    }).compileComponents();

    fixture = TestBed.createComponent(FeatureAi);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

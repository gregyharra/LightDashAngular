import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FeatureExport } from './feature-export';

describe('FeatureExport', () => {
  let component: FeatureExport;
  let fixture: ComponentFixture<FeatureExport>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeatureExport]
    }).compileComponents();

    fixture = TestBed.createComponent(FeatureExport);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

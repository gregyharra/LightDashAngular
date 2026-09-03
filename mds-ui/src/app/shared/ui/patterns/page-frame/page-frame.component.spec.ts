import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DpfPageFrameComponent } from './page-frame.component';

describe('DpfPageFrameComponent', () => {
  let fixture: ComponentFixture<DpfPageFrameComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DpfPageFrameComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(DpfPageFrameComponent);
    fixture.detectChanges();
  });

  it('uses the standard page container by default', () => {
    const container = fixture.debugElement.query(By.css('.page__container'));

    expect(container).not.toBeNull();
    expect(container.nativeElement.classList).not.toContain('page__container--wide');
  });

  it('uses the wide page container when requested', () => {
    fixture.componentRef.setInput('wide', true);
    fixture.detectChanges();
    const container = fixture.debugElement.query(By.css('.page__container'));

    expect(container.nativeElement.classList).toContain('page__container--wide');
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideTranslateService } from '@ngx-translate/core';
import { DpfContentListFilterChipsComponent } from './content-list-filter-chips.component';

describe('DpfContentListFilterChipsComponent', () => {
  let fixture: ComponentFixture<DpfContentListFilterChipsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DpfContentListFilterChipsComponent],
      providers: [provideTranslateService()],
    }).compileComponents();

    fixture = TestBed.createComponent(DpfContentListFilterChipsComponent);
    fixture.componentRef.setInput('chips', [
      { key: 'name', label: 'Name', displayValue: 'Quarterly' },
    ]);
    fixture.detectChanges();
  });

  it('projects chips and emits clearChip / clearAll', () => {
    const clearChipSpy = spyOn(fixture.componentInstance.clearChip, 'emit');
    const clearAllSpy = spyOn(fixture.componentInstance.clearAll, 'emit');

    fixture.debugElement
      .query(By.css('.dpf-content-list-filter-chips__chip-remove'))
      .triggerEventHandler('click');
    fixture.debugElement
      .query(By.css('.dpf-content-list-filter-chips__clear-all'))
      .triggerEventHandler('click');

    expect(fixture.nativeElement.textContent).toContain('Quarterly');
    expect(clearChipSpy).toHaveBeenCalledOnceWith('name');
    expect(clearAllSpy).toHaveBeenCalledTimes(1);
  });
});

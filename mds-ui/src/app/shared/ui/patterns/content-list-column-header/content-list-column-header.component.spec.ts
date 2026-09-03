import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideTranslateService } from '@ngx-translate/core';
import { DpfContentListColumnHeaderComponent } from './content-list-column-header.component';

describe('DpfContentListColumnHeaderComponent', () => {
  let fixture: ComponentFixture<DpfContentListColumnHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DpfContentListColumnHeaderComponent],
      providers: [provideNoopAnimations(), provideTranslateService()],
    }).compileComponents();

    fixture = TestBed.createComponent(DpfContentListColumnHeaderComponent);
    fixture.componentRef.setInput('label', 'Name');
    fixture.componentRef.setInput('filterType', 'text');
    fixture.componentRef.setInput('value', { query: 'Quarterly' });
    fixture.detectChanges();
  });

  it('renders the label and marks an active filter', () => {
    const filterButton = fixture.debugElement.query(
      By.css('.dpf-content-list-column-header__filter-btn'),
    );

    expect(fixture.nativeElement.textContent).toContain('Name');
    expect(
      filterButton.nativeElement.classList.contains(
        'dpf-content-list-column-header__filter-btn--active',
      ),
    ).toBeTrue();
  });

  it('opens the text filter menu and emits valueChange on apply', () => {
    const valueChangeSpy = spyOn(fixture.componentInstance.valueChange, 'emit');

    fixture.debugElement
      .query(By.css('.dpf-content-list-column-header__filter-btn'))
      .nativeElement.click();
    fixture.detectChanges();

    const input = document.querySelector(
      '.dpf-content-list-column-header__input[type="search"]',
    ) as HTMLInputElement;
    input.value = 'Revenue';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    (
      document.querySelector(
        '.dpf-content-list-column-header__apply-btn',
      ) as HTMLButtonElement
    ).click();

    expect(valueChangeSpy).toHaveBeenCalledOnceWith({ query: 'Revenue' });
  });
});

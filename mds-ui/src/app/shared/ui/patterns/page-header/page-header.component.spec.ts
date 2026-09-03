import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DpfActionClusterComponent } from '../action-cluster/action-cluster.component';
import { DpfPageHeaderComponent } from './page-header.component';

@Component({
  imports: [DpfPageHeaderComponent],
  template: `
    <dpf-page-header title="Orders" subtitle="Review recent orders" titleTone="brand">
      <button dpfActions type="button">Export</button>
    </dpf-page-header>
  `,
})
class TestHostComponent {}

describe('DpfPageHeaderComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
  });

  it('renders its title and subtitle', () => {
    const header = fixture.debugElement.query(By.directive(DpfPageHeaderComponent));
    const title = header.query(By.css('.dpf-page-header__title')).nativeElement as HTMLElement;
    const subtitle = header.query(By.css('.dpf-page-header__subtitle')).nativeElement as HTMLElement;

    expect(title.textContent.trim()).toBe('Orders');
    expect(subtitle.textContent.trim()).toBe('Review recent orders');
    expect(getComputedStyle(title).fontSize).toBe('18px');
    expect(getComputedStyle(title).fontWeight).toBe('600');
    expect(getComputedStyle(title).lineHeight).toBe('23.4px');
    expect(getComputedStyle(subtitle).fontSize).toBe('14px');
    expect(getComputedStyle(title).color).toBe('rgb(30, 58, 138)');
  });

  it('projects dpfActions into an action cluster', () => {
    const cluster = fixture.debugElement.query(By.directive(DpfActionClusterComponent));
    const action = cluster.query(By.css('[dpfActions]')).nativeElement as HTMLButtonElement;

    expect(action.textContent?.trim()).toBe('Export');
  });
});

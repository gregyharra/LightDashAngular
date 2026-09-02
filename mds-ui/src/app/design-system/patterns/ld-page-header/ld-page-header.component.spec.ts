import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { LdActionClusterComponent } from '../ld-action-cluster/ld-action-cluster.component';
import { LdPageHeaderComponent } from './ld-page-header.component';

@Component({
  imports: [LdPageHeaderComponent],
  template: `
    <ld-page-header title="Orders" subtitle="Review recent orders">
      <button ldActions type="button">Export</button>
    </ld-page-header>
  `,
})
class TestHostComponent {}

describe('LdPageHeaderComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
  });

  it('renders its title and subtitle', () => {
    const header = fixture.debugElement.query(By.directive(LdPageHeaderComponent));

    expect(header.query(By.css('h1')).nativeElement.textContent.trim()).toBe('Orders');
    expect(header.query(By.css('.ld-page-header__subtitle')).nativeElement.textContent.trim())
      .toBe('Review recent orders');
  });

  it('projects ldActions into an action cluster', () => {
    const cluster = fixture.debugElement.query(By.directive(LdActionClusterComponent));
    const action = cluster.query(By.css('[ldActions]')).nativeElement as HTMLButtonElement;

    expect(action.textContent?.trim()).toBe('Export');
  });
});

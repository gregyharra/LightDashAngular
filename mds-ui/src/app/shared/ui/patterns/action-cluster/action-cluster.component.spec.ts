import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DpfActionClusterComponent } from './action-cluster.component';

@Component({
  imports: [DpfActionClusterComponent],
  template: `
    <dpf-action-cluster>
      <button type="button">Refresh</button>
    </dpf-action-cluster>
  `,
})
class TestHostComponent {}

describe('DpfActionClusterComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
  });

  it('applies its host class and projects actions', () => {
    const cluster = fixture.debugElement.query(By.directive(DpfActionClusterComponent));
    const button = cluster.query(By.css('button')).nativeElement as HTMLButtonElement;

    expect((cluster.nativeElement as HTMLElement).classList).toContain('dpf-action-cluster');
    expect(button.textContent?.trim()).toBe('Refresh');
    expect(getComputedStyle(button).whiteSpace).toBe('nowrap');
    expect(getComputedStyle(button).flexShrink).toBe('0');
  });
});

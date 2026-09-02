import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { LdActionClusterComponent } from './ld-action-cluster.component';

@Component({
  imports: [LdActionClusterComponent],
  template: `
    <ld-action-cluster>
      <button type="button">Refresh</button>
    </ld-action-cluster>
  `,
})
class TestHostComponent {}

describe('LdActionClusterComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
  });

  it('applies its host class and projects actions', () => {
    const cluster = fixture.debugElement.query(By.directive(LdActionClusterComponent));
    const button = cluster.query(By.css('button')).nativeElement as HTMLButtonElement;

    expect((cluster.nativeElement as HTMLElement).classList).toContain('ld-action-cluster');
    expect(button.textContent?.trim()).toBe('Refresh');
    expect(getComputedStyle(button).whiteSpace).toBe('nowrap');
    expect(getComputedStyle(button).flexShrink).toBe('0');
  });
});

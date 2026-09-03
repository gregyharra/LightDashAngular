import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DpfAppTopbarComponent } from './app-topbar.component';

@Component({
  imports: [DpfAppTopbarComponent],
  template: `
    <dpf-app-topbar>
      <div dpfBrand>Brand content</div>
      <div dpfCenter>Center content</div>
      <div dpfActions>Actions content</div>
    </dpf-app-topbar>
  `,
})
class TestHostComponent {}

describe('DpfAppTopbarComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
  });

  it('projects brand content into the brand column', () => {
    expect(
      fixture.nativeElement.querySelector('.dpf-app-topbar__brand')?.textContent,
    ).toContain('Brand content');
  });

  it('projects center content into the center column', () => {
    expect(
      fixture.nativeElement.querySelector('.dpf-app-topbar__center')?.textContent,
    ).toContain('Center content');
  });

  it('projects actions content into the actions column', () => {
    expect(
      fixture.nativeElement.querySelector('.dpf-app-topbar__actions')?.textContent,
    ).toContain('Actions content');
  });
});

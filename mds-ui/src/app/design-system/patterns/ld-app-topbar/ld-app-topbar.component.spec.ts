import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LdAppTopbarComponent } from './ld-app-topbar.component';

@Component({
  imports: [LdAppTopbarComponent],
  template: `
    <ld-app-topbar>
      <div ldBrand>Brand content</div>
      <div ldCenter>Center content</div>
      <div ldActions>Actions content</div>
    </ld-app-topbar>
  `,
})
class TestHostComponent {}

describe('LdAppTopbarComponent', () => {
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
      fixture.nativeElement.querySelector('.ld-app-topbar__brand')?.textContent,
    ).toContain('Brand content');
  });

  it('projects center content into the center column', () => {
    expect(
      fixture.nativeElement.querySelector('.ld-app-topbar__center')?.textContent,
    ).toContain('Center content');
  });

  it('projects actions content into the actions column', () => {
    expect(
      fixture.nativeElement.querySelector('.ld-app-topbar__actions')?.textContent,
    ).toContain('Actions content');
  });
});

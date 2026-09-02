import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { RouterLink, provideRouter } from '@angular/router';
import { LdBrandMarkComponent } from './ld-brand-mark.component';

describe('LdBrandMarkComponent', () => {
  let fixture: ComponentFixture<LdBrandMarkComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LdBrandMarkComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(LdBrandMarkComponent);
    fixture.componentRef.setInput('ariaLabel', 'Lightdash projects');
    fixture.componentRef.setInput('lead', 'Light');
    fixture.componentRef.setInput('trail', 'dash');
  });

  it('renders the mark and wordmark text', () => {
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const image = host.querySelector('img') as HTMLImageElement;
    expect(image.getAttribute('src')).toBe('assets/brand-mark.svg');
    expect(host.querySelector('em')?.textContent).toContain('Light');
    expect(host.textContent).toContain('dash');
  });

  it('applies RouterLink when provided', () => {
    fixture.componentRef.setInput('routerLink', ['/projects']);
    fixture.detectChanges();
    const link = fixture.debugElement.query(By.directive(RouterLink));
    expect(link).not.toBeNull();
    expect((link.nativeElement as HTMLAnchorElement).getAttribute('href')).toBe('/projects');
  });
});

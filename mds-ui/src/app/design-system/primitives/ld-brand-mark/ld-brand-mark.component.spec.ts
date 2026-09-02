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
    const wordmark = host.querySelector('.ld-brand-mark__wordmark') as HTMLElement;
    const lead = host.querySelector('em') as HTMLElement;
    expect(image.getAttribute('src')).toBe('assets/brand-mark.svg');
    expect(lead.textContent).toContain('Light');
    expect(host.textContent).toContain('dash');
    expect(getComputedStyle(image).width).toBe('34px');
    expect(getComputedStyle(image).height).toBe('34px');
    expect(getComputedStyle(wordmark).fontSize).toBe('18.4px');
    expect(getComputedStyle(wordmark).fontWeight).toBe('700');
    expect(getComputedStyle(wordmark).overflow).toBe('hidden');
    expect(getComputedStyle(wordmark).textOverflow).toBe('ellipsis');
    expect(getComputedStyle(wordmark).color).toBe('rgb(30, 58, 138)');
    expect(getComputedStyle(lead).color).toBe('rgb(26, 27, 30)');
  });

  it('applies RouterLink when provided', () => {
    fixture.componentRef.setInput('routerLink', ['/projects']);
    fixture.detectChanges();
    const link = fixture.debugElement.query(By.directive(RouterLink));
    expect(link).not.toBeNull();
    expect((link.nativeElement as HTMLAnchorElement).getAttribute('href')).toBe('/projects');
  });
});

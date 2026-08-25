import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { DateAdapter, MAT_DATE_LOCALE } from '@angular/material/core';
import { provideNativeDateAdapter } from '@angular/material/core';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { firstValueFrom, of } from 'rxjs';
import {
  LanguageService,
  MDS_LANG_STORAGE_KEY,
} from './language.service';

class FakeTranslateService {
  use = jasmine.createSpy('use').and.callFake((lang: string) => of(lang));
  get = jasmine.createSpy('get').and.callFake((key: string) => of(key));
  instant = jasmine.createSpy('instant').and.callFake((key: string) => key);
}

describe('LanguageService', () => {
  let service: LanguageService;
  let translate: FakeTranslateService;
  let storage: Storage;
  let doc: Document;
  let dateAdapter: DateAdapter<unknown>;

  beforeEach(() => {
    storage = window.localStorage;
    storage.removeItem(MDS_LANG_STORAGE_KEY);

    TestBed.configureTestingModule({
      providers: [
        provideTranslateService({ fallbackLang: 'en', lang: 'en' }),
        { provide: TranslateService, useClass: FakeTranslateService },
        provideNativeDateAdapter(),
        LanguageService,
      ],
    });

    service = TestBed.inject(LanguageService);
    translate = TestBed.inject(TranslateService) as unknown as FakeTranslateService;
    doc = TestBed.inject(DOCUMENT);
    dateAdapter = TestBed.inject(DateAdapter);
    spyOn(dateAdapter, 'setLocale').and.callThrough();
  });

  afterEach(() => {
    storage.removeItem(MDS_LANG_STORAGE_KEY);
  });

  it('uses mds.lang when set to en or fr', async () => {
    storage.setItem(MDS_LANG_STORAGE_KEY, 'fr');
    await service.init();
    expect(service.language()).toBe('fr');
    expect(service.locale()).toBe('fr-FR');
    expect(translate.use).toHaveBeenCalledWith('fr');
    expect(doc.documentElement.lang).toBe('fr');
    expect(storage.getItem(MDS_LANG_STORAGE_KEY)).toBe('fr');
  });

  it('ignores invalid mds.lang and falls back to browser', async () => {
    storage.setItem(MDS_LANG_STORAGE_KEY, 'de');
    spyOnProperty(window.navigator, 'languages', 'get').and.returnValue(['en-US']);
    spyOnProperty(window.navigator, 'language', 'get').and.returnValue('en-US');
    await service.init();
    expect(service.language()).toBe('en');
  });

  it('uses French when browser languages include fr* and storage empty', async () => {
    spyOnProperty(window.navigator, 'languages', 'get').and.returnValue([
      'fr-FR',
      'en-US',
    ]);
    await service.init();
    expect(service.language()).toBe('fr');
    expect(storage.getItem(MDS_LANG_STORAGE_KEY)).toBe('fr');
  });

  it('defaults to English when browser is non-French', async () => {
    spyOnProperty(window.navigator, 'languages', 'get').and.returnValue(['de-DE']);
    spyOnProperty(window.navigator, 'language', 'get').and.returnValue('de-DE');
    await service.init();
    expect(service.language()).toBe('en');
    expect(service.locale()).toBe('en-US');
  });

  it('setLanguage updates translate, storage, html lang, and date locale', async () => {
    await service.init();
    await service.setLanguage('fr');
    expect(service.language()).toBe('fr');
    expect(translate.use).toHaveBeenCalledWith('fr');
    expect(storage.getItem(MDS_LANG_STORAGE_KEY)).toBe('fr');
    expect(doc.documentElement.lang).toBe('fr');
    expect(dateAdapter.setLocale).toHaveBeenCalledWith('fr-FR');
  });

  it('formatNumber uses active locale', async () => {
    await service.setLanguage('fr');
    const formatted = service.formatNumber(1234.5, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    expect(formatted).toMatch(/1[\s\u00a0\u202f]?234,5/);
  });
});

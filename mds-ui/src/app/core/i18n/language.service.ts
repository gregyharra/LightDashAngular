import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { DateAdapter, MAT_DATE_LOCALE } from '@angular/material/core';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';

export type AppLanguage = 'en' | 'fr';
export type AppLocale = 'en-US' | 'fr-FR';

export const MDS_LANG_STORAGE_KEY = 'mds.lang';

function isAppLanguage(value: string | null | undefined): value is AppLanguage {
  return value === 'en' || value === 'fr';
}

function localeFor(lang: AppLanguage): AppLocale {
  return lang === 'fr' ? 'fr-FR' : 'en-US';
}

function detectBrowserLanguage(): AppLanguage {
  const tags = [
    ...(navigator.languages ?? []),
    navigator.language,
  ].filter(Boolean);
  for (const tag of tags) {
    if (tag.toLowerCase().startsWith('fr')) {
      return 'fr';
    }
  }
  return 'en';
}

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translate = inject(TranslateService);
  private readonly document = inject(DOCUMENT);
  private readonly dateAdapter = inject(DateAdapter);
  private readonly matDateLocale = inject(MAT_DATE_LOCALE, { optional: true });

  private readonly languageSignal = signal<AppLanguage>('en');
  private readonly localeSignal = signal<AppLocale>('en-US');

  readonly language = this.languageSignal.asReadonly();
  readonly locale = this.localeSignal.asReadonly();

  async init(): Promise<void> {
    const stored = localStorage.getItem(MDS_LANG_STORAGE_KEY);
    const lang = isAppLanguage(stored) ? stored : detectBrowserLanguage();
    await this.apply(lang);
  }

  async setLanguage(lang: AppLanguage): Promise<void> {
    await this.apply(lang);
  }

  formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
    return new Intl.NumberFormat(this.localeSignal(), options).format(value);
  }

  private async apply(lang: AppLanguage): Promise<void> {
    const locale = localeFor(lang);
    await firstValueFrom(this.translate.use(lang));
    this.document.documentElement.lang = lang;
    localStorage.setItem(MDS_LANG_STORAGE_KEY, lang);
    this.dateAdapter.setLocale(locale);
    if (
      this.matDateLocale &&
      typeof this.matDateLocale === 'object' &&
      'set' in (this.matDateLocale as object)
    ) {
      // no-op for string token; locale string providers are replaced via setLocale
    }
    this.languageSignal.set(lang);
    this.localeSignal.set(locale);
  }
}

import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { DateAdapter } from '@angular/material/core';
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

  private readonly languageSignal = signal<AppLanguage>('en');
  private readonly localeSignal = signal<AppLocale>('en-US');

  readonly language = this.languageSignal.asReadonly();
  readonly locale = this.localeSignal.asReadonly();

  async init(): Promise<void> {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(MDS_LANG_STORAGE_KEY);
    } catch {
      // Storage can be disabled by browser privacy settings.
    }
    const lang = isAppLanguage(stored) ? stored : detectBrowserLanguage();
    await this.apply(lang);
  }

  async setLanguage(lang: AppLanguage): Promise<void> {
    await this.apply(lang);
  }

  formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
    return new Intl.NumberFormat(this.localeSignal(), options).format(value);
  }

  formatDate(
    value: string | number | Date,
    options?: Intl.DateTimeFormatOptions,
  ): string {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value);
    }
    return new Intl.DateTimeFormat(this.localeSignal(), options).format(date);
  }

  private async apply(lang: AppLanguage): Promise<void> {
    let appliedLanguage = lang;
    try {
      await firstValueFrom(this.translate.use(lang));
    } catch {
      appliedLanguage = 'en';
      if (lang !== 'en') {
        try {
          await firstValueFrom(this.translate.use('en'));
        } catch {
          // Keep bootstrapping with ngx-translate's configured English fallback.
        }
      }
    }

    const locale = localeFor(appliedLanguage);
    this.document.documentElement.lang = appliedLanguage;
    try {
      localStorage.setItem(MDS_LANG_STORAGE_KEY, appliedLanguage);
    } catch {
      // Language still applies when persistence is unavailable.
    }
    this.dateAdapter.setLocale(locale);
    this.languageSignal.set(appliedLanguage);
    this.localeSignal.set(locale);
  }
}

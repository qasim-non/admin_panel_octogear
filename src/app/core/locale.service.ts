import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';

import { en, TextKey } from './i18n/en';
import { ar } from './i18n/ar';
export type { TextKey } from './i18n/en';
export type Language = 'en' | 'ar';

@Injectable({ providedIn: 'root' })
export class LocaleService {
    private readonly document = inject(DOCUMENT);
    readonly language = signal<'en' | 'ar'>('en');
    constructor() {
        try { this.set(localStorage.getItem('octogear.locale') === 'ar' ? 'ar' : 'en'); } catch { this.set('en'); }
    }
    t(key: TextKey): string { return (this.language() === 'ar' ? ar : en)[key]; }
    toggle(): void { this.set(this.language() === 'en' ? 'ar' : 'en'); }
    set(language: Language): void {
        this.language.set(language);
        this.document.documentElement.lang = language;
        this.document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
        try { localStorage.setItem('octogear.locale', language); } catch { /* Preference storage is optional. */ }
    }
}

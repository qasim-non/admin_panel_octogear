import { inject, Injectable } from '@angular/core';
import { finalize, map, Observable, of, shareReplay, tap } from 'rxjs';
import { ApiClient } from './api-client';
import { AppSettings } from './app-settings';

export interface CityOption { id: number; name: string; }
export interface CatalogCity { id: number; name_en: string; name_ar: string; }

@Injectable({ providedIn: 'root' })
export class CityCatalog {
    private readonly api = inject(ApiClient);
    private readonly settings = inject(AppSettings);
    private base = '';
    private cities: CatalogCity[] | null = null;
    private pending: Observable<CatalogCity[]> | null = null;

    load(): Observable<CatalogCity[]> {
        const base = this.settings.apiBaseUrl();
        if (this.base !== base) { this.base = base; this.cities = null; this.pending = null; }
        if (this.cities) return of(this.cities);
        if (this.pending) return this.pending;
        const request = this.api.get<CatalogCity[]>('admin/cities/options').pipe(
            map(response => {
                if (!response.success || !Array.isArray(response.data)
                    || response.data.some(city => !Number.isSafeInteger(city.id) || typeof city.name_en !== 'string' || typeof city.name_ar !== 'string')) {
                    throw new Error('Invalid cities response');
                }
                return response.data;
            }),
            tap(cities => { if (this.base === base) this.cities = cities; }),
            finalize(() => { if (this.pending === request) this.pending = null; }),
            // Concurrent consumers share one download, including while navigating between pages.
            shareReplay({ bufferSize: 1, refCount: false })
        );
        this.pending = request;
        return request;
    }

    find(language: string, id: number): CityOption | undefined {
        const city = this.base === this.settings.apiBaseUrl() ? this.cities?.find(city => city.id === id) : undefined;
        return city ? { id, name: language === 'ar' ? city.name_ar : city.name_en } : undefined;
    }
}

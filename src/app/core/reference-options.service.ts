import { inject, Injectable, signal } from '@angular/core';
import { finalize, map, Observable, of, shareReplay, tap } from 'rxjs';
import { ApiClient } from './api-client';
import { AppSettings } from './app-settings';

export interface ReferenceOption { id: number; name: string; }
export interface BilingualReference { id: number; name_en: string; name_ar: string; }
type CatalogPath = 'admin/cities/options' | 'admin/car-companies/options' | 'admin/catalog-countries/options';

@Injectable({ providedIn: 'root' })
export class ReferenceOptions {
    readonly revision = signal(0);
    invalidate(path: CatalogPath): void {
        this.values.delete(path); this.pending.delete(path); this.revision.update(n => n + 1);
    }
    private readonly api = inject(ApiClient);
    private readonly settings = inject(AppSettings);
    private base = '';
    private readonly values = new Map<CatalogPath, BilingualReference[]>();
    private readonly pending = new Map<CatalogPath, Observable<BilingualReference[]>>();

    load(path: CatalogPath): Observable<BilingualReference[]> {
        const base = this.settings.apiBaseUrl();
        if (this.base !== base) { this.base = base; this.values.clear(); this.pending.clear(); }
        const saved = this.values.get(path), pending = this.pending.get(path);
        if (saved) return of(saved);
        if (pending) return pending;
        const request = this.api.get<BilingualReference[]>(path).pipe(
            map(response => {
                if (!response.success || !Array.isArray(response.data) || response.data.some(item => !item ||
                    !Number.isSafeInteger(item.id) || item.id <= 0 || typeof item.name_en !== 'string' || typeof item.name_ar !== 'string')) {
                    throw new Error('Invalid reference options');
                }
                return response.data;
            }),
            tap(items => { if (this.base === base && this.pending.get(path) === request) this.values.set(path, items); }),
            finalize(() => { if (this.pending.get(path) === request) this.pending.delete(path); }),
            // Small, complete reference lists share one in-flight read and search locally.
            shareReplay({ bufferSize: 1, refCount: false })
        );
        this.pending.set(path, request);
        return request;
    }

    find(path: CatalogPath, language: string, id: number): ReferenceOption | undefined {
        const item = this.base === this.settings.apiBaseUrl() ? this.values.get(path)?.find(item => item.id === id) : undefined;
        return item ? { id, name: language === 'ar' ? item.name_ar : item.name_en } : undefined;
    }
}

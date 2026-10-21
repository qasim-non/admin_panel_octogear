import { inject, Injectable } from '@angular/core';
import { map, tap } from 'rxjs';
import { ApiClient } from '../../core/api-client';
import { ReferenceOption, ReferenceOptions } from '../../core/reference-options.service';

export type CatalogKind = 'companies' | 'models';
export interface CatalogRow extends ReferenceOption {
    name_en: string; name_ar: string; version: string;
    country_id?: number | null; car_company_id?: number;
    country?: ReferenceOption | null;
    models_count?: number;
    company?: (ReferenceOption & { country: ReferenceOption | null }) | null;
}
export interface CatalogFilters { search: string; company_id: number | null; page: number; }

@Injectable({ providedIn: 'root' })
export class VehicleCatalogApi {
    private readonly api = inject(ApiClient);
    private readonly options = inject(ReferenceOptions);
    save(kind: CatalogKind, body: unknown, id?: number) {
        const path = kind === 'companies' ? 'admin/car-companies' : 'admin/car-names';
        return this.afterWrite(kind, id ? this.api.patch<CatalogRow>(`${path}/${id}`, body) : this.api.post<CatalogRow>(path, body));
    }
    remove(kind: CatalogKind, row: CatalogRow) {
        return this.afterWrite(kind, this.api.delete<null>(`${kind === 'companies' ? 'admin/car-companies' : 'admin/car-names'}/${row.id}`, { version: row.version }));
    }
    private afterWrite<T>(kind: CatalogKind, request: import('rxjs').Observable<T>) {
        const invalidate = () => { if (kind === 'companies') this.options.invalidate('admin/car-companies/options'); };
        return request.pipe(tap({ next: invalidate, error: invalidate }));
    }
    list(kind: CatalogKind, filters: CatalogFilters) {
        const params: Record<string, string | number> = { page: filters.page };
        if (filters.search) params['search'] = filters.search;
        if (kind === 'models' && filters.company_id) params['company_id'] = filters.company_id;
        return this.api.get<CatalogRow[]>(kind === 'companies' ? 'admin/car-companies' : 'admin/car-names', params).pipe(map(response => {
            const meta = response.meta;
            if (!response.success || !Array.isArray(response.data) || !meta ||
                ![meta.current_page, meta.last_page, meta.per_page].every(n => Number.isSafeInteger(n) && n > 0) ||
                !Number.isSafeInteger(meta.total) || meta.total < 0 || response.data.some(row => !this.validLabel(row) ||
                    typeof row.name_en !== 'string' || typeof row.name_ar !== 'string' || !/^[a-f0-9]{64}$/.test(row.version ?? '') ||
                    (kind === 'companies' && (!Number.isSafeInteger(row.models_count) || row.models_count! < 0 || !this.nullableLabel(row.country))) ||
                    (kind === 'models' && (!this.validLabel(row.company) || !this.nullableLabel(row.company?.country) ||
                        (filters.company_id !== null && row.company?.id !== filters.company_id))))) {
                throw new Error('Invalid vehicle catalog');
            }
            return { rows: response.data, meta };
        }));
    }
    private validLabel(value: unknown): value is ReferenceOption {
        return !!value && typeof value === 'object' && 'id' in value && Number.isSafeInteger(value.id) && Number(value.id) > 0 && 'name' in value && typeof value.name === 'string';
    }
    private nullableLabel(value: unknown): boolean { return value === null || this.validLabel(value); }
}

import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../../core/api-client';
import { ReferenceOption } from '../../core/reference-options.service';

export type CatalogKind = 'companies' | 'models';
export interface CatalogRow extends ReferenceOption {
    country?: ReferenceOption | null;
    models_count?: number;
    company?: (ReferenceOption & { country: ReferenceOption | null }) | null;
}
export interface CatalogFilters { search: string; company_id: number | null; page: number; }

@Injectable({ providedIn: 'root' })
export class VehicleCatalogApi {
    private readonly api = inject(ApiClient);
    list(kind: CatalogKind, filters: CatalogFilters) {
        const params: Record<string, string | number> = { page: filters.page };
        if (filters.search) params['search'] = filters.search;
        if (kind === 'models' && filters.company_id) params['company_id'] = filters.company_id;
        return this.api.get<CatalogRow[]>(kind === 'companies' ? 'admin/car-companies' : 'admin/car-names', params).pipe(map(response => {
            const meta = response.meta;
            if (!response.success || !Array.isArray(response.data) || !meta ||
                ![meta.current_page, meta.last_page, meta.per_page].every(n => Number.isSafeInteger(n) && n > 0) ||
                !Number.isSafeInteger(meta.total) || meta.total < 0 || response.data.some(row => !this.validLabel(row) ||
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

import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient, errorMessage } from '../../core/api-client';
import { LocaleService } from '../../core/locale.service';

export type StoreStatus = 'active' | 'inactive';
export interface AdminStore {
    id: number; name: string; nick_name: string | null; mobile: string; status: StoreStatus;
    employee_name: string | null; url_location: string | null; commercial_registration_number: string | null;
    owner: { id: number; full_name: string; mobile: string } | null;
    city: { id: number; name: string } | null;
    created_at: string; cars_count: number; average_rating: number | null;
    commercial_registration_picture: string | null;
}
export interface StoreDetail extends AdminStore {
    companies: { id: number; name: string }[];
    pictures: { id: number; url: string }[];
    pending_change_request_id: number | null;
}
export interface StoreFilters {
    name?: string; mobile?: string; status?: StoreStatus | ''; city_id?: number | null; owner_id?: number | null; page: number;
}

@Injectable({ providedIn: 'root' })
export class StoreApi {
    private readonly api = inject(ApiClient);
    list(filters: StoreFilters) {
        const params: Record<string, string | number> = { page: filters.page };
        for (const [key, value] of Object.entries(filters)) if (value !== null && value !== undefined && value !== '') params[key] = value;
        return this.api.get<AdminStore[]>('admin/stores', params).pipe(map(response => {
            if (!response.success || !Array.isArray(response.data) || !response.meta
                || response.data.some(row => !['active', 'inactive'].includes(row.status)
                    || (filters.owner_id && row.owner?.id !== filters.owner_id))) throw new Error('Invalid store list');
            return { stores: response.data, meta: response.meta };
        }));
    }
    get(id: number) {
        return this.api.get<StoreDetail>(`admin/stores/${id}`).pipe(map(response => {
            const store = response.data;
            if (!response.success || store?.id !== id || !['active', 'inactive'].includes(store.status)
                || !Array.isArray(store.companies) || !Array.isArray(store.pictures)) throw new Error('Invalid store detail');
            return store;
        }));
    }
    setStatus(id: number, status: StoreStatus) {
        return this.api.patch<StoreDetail>(`admin/stores/${id}/status`, { status }).pipe(map(response => {
            if (!response.success || response.data?.id !== id || response.data.status !== status) throw new Error('Unconfirmed store status');
            return response.data;
        }));
    }
}

export function storeError(error: unknown, locale: LocaleService): string {
    if (error instanceof HttpErrorResponse) {
        if (error.status === 403) return locale.t('storeManagementDenied');
        if (error.status === 422) return locale.t('storeFiltersInvalid');
    }
    return errorMessage(error, locale);
}

import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient, errorMessage } from '../../core/api-client';
import { LocaleService } from '../../core/locale.service';

export type RequestStatus = 'pending' | 'accepted' | 'rejected';
export type RequestType = 'new_store' | 'store_change';
export interface ReviewFields {
    name: string; nick_name: string; employee_name: string; mobile: string;
    url_location: string; commercial_registration_number: string; company_ids: number[];
}
export interface StoreRequest extends ReviewFields {
    id: number; request_type: RequestType; store_id: number | null; request_status: RequestStatus;
    city: { id: number; name: string } | null;
    user: { id: number; full_name: string; mobile: string } | null;
    created_at: string; processed_at: string | null; processed_by: number | null;
    rejection_reason: string | null; change_reason: string | null;
    commercial_registration_picture: string | null;
    pictures: { id: number; url: string }[];
    previous_details: (ReviewFields & { city_id: number }) | null;
    review_companies?: { id: number; name: string }[];
    previous_city?: { id: number; name: string } | null;
}
export interface RequestFilters { search: string; status: RequestStatus | ''; request_type: RequestType | ''; city_id: number | null; page: number; }

@Injectable({ providedIn: 'root' })
export class StoreRequestApi {
    private readonly api = inject(ApiClient);
    list(filters: RequestFilters) {
        const params: Record<string, string | number> = { page: filters.page };
        for (const [key, value] of Object.entries(filters)) if (value) params[key] = value;
        return this.api.get<StoreRequest[]>('admin/store-requests', params).pipe(map(response => {
            if (!response.success || !Array.isArray(response.data) || !response.meta) throw new Error('Invalid request list');
            return { rows: response.data, meta: response.meta };
        }));
    }
    get(id: number) {
        return this.api.get<StoreRequest>(`admin/store-requests/${id}`).pipe(map(response => {
            const data = response.data;
            if (!response.success || !data || !['new_store', 'store_change'].includes(data.request_type)
                || !['pending', 'accepted', 'rejected'].includes(data.request_status) || !Array.isArray(data.review_companies)) throw new Error('Invalid review detail');
            return data;
        }));
    }
    review(id: number, action: 'accept' | 'reject', reason: string) {
        return this.api.post<StoreRequest>(`admin/store-requests/${id}/${action}`, action === 'reject' ? { reason } : {}).pipe(map(response => {
            if (!response.success || response.data?.request_status !== (action === 'accept' ? 'accepted' : 'rejected')) throw new Error('Unconfirmed review');
            return response.data;
        }));
    }
}

export function requestError(error: unknown, locale: LocaleService): string {
    if (error instanceof HttpErrorResponse) {
        if (error.status === 403) return locale.t('requestsDenied');
        if (error.status === 422) return locale.t('requestFiltersInvalid');
    }
    return errorMessage(error, locale);
}

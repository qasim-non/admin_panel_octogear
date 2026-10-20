import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient, errorMessage } from '../../core/api-client';
import { UserKind } from './user-directory.config';
import { LocaleService, TextKey } from '../../core/locale.service';

export type UserStatus = 'unblocked' | 'blocked';
export interface AdminUser {
    id: number;
    full_name: string;
    mobile: string;
    type: 'customer' | 'service provider';
    status: UserStatus;
    orders_count: number;
    stores_count: number;
    city: { id: number; name: string } | null;
    created_at: string;
}
export interface UserFilters { name: string; mobile: string; status: UserStatus | ''; city_id: number | null; page: number; }

@Injectable({ providedIn: 'root' })
export class UserApi {
    private readonly api = inject(ApiClient);
    list(kind: UserKind, filters: UserFilters) {
        const params: Record<string, string | number> = { page: filters.page };
        if (filters.name) params['name'] = filters.name;
        if (filters.mobile) params['mobile'] = filters.mobile;
        if (filters.status) params['status'] = filters.status;
        if (filters.city_id) params['city_id'] = filters.city_id;
        return this.api.get<AdminUser[]>(`admin/users/${kind}`, params).pipe(map(response => {
            if (!response.success || !Array.isArray(response.data) || !response.meta) throw new Error('Invalid user list response');
            return { users: response.data, meta: response.meta };
        }));
    }
    get(id: number) { return this.api.get<AdminUser>(`admin/users/${id}`).pipe(map(response => {
        if (!response.success || !response.data) throw new Error('Invalid user response');
        return response.data;
    })); }
    setStatus(id: number, status: UserStatus) {
        return this.api.patch<AdminUser>(`admin/users/${id}/status`, { status }).pipe(map(response => {
            if (!response.success || response.data?.status !== status) throw new Error('Unconfirmed status response');
            return response.data;
        }));
    }
}

export function userError(error: unknown, locale: LocaleService, denied: TextKey): string {
    if (error instanceof HttpErrorResponse) {
        if (error.status === 403) return locale.t(denied);
        if (error.status === 422) return locale.t('customerValidationError');
    }
    return errorMessage(error, locale);
}
export function userInitials(name: string): string {
    return name.trim().split(/\s+/).slice(0, 2).map(part => Array.from(part)[0] ?? '').join('');
}
export function userDate(value: string, language: 'en' | 'ar', includeTime = false): string {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '—';
    return new Intl.DateTimeFormat(language === 'ar' ? 'ar-SA-u-ca-gregory' : 'en-GB', {
        timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric',
        ...(includeTime ? { hour: '2-digit', minute: '2-digit' } as const : {})
    }).format(date);
}

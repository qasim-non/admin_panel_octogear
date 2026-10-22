import { inject, Injectable } from '@angular/core';
import { ApiClient, ApiEnvelope, errorMessage } from '../../core/api-client';
import { HttpErrorResponse } from '@angular/common/http';
import { LocaleService } from '../../core/locale.service';

export interface AdminAccount {
    employee_id: number; name: string; email: string; mobile: string; assigned_role: string;
    status: string; preferred_language: 'en' | 'ar' | null; must_change_password: boolean;
    temporary_password_expires_at: string | null; last_login_at: string | null; version: number; created_at: string;
}
export interface AdminRoleOption { value: string; permissions: string[]; }
export interface AdminAuditEvent { id: number; actor_id: number | null; action: string; created_at: string; }

@Injectable({ providedIn: 'root' })
export class AdminAccountApi {
    private readonly api = inject(ApiClient);
    list(params: Record<string, string | number>) { return this.api.get<AdminAccount[]>('admin/accounts', params); }
    roles() { return this.api.get<AdminRoleOption[]>('admin/accounts/roles'); }
    save(row: AdminAccount | null, body: unknown) { return row ? this.api.patch<AdminAccount>(`admin/accounts/${row.employee_id}`, body) : this.api.post<AdminAccount>('admin/accounts', body); }
    reset(row: AdminAccount, body: unknown) { return this.api.post<AdminAccount>(`admin/accounts/${row.employee_id}/reset-password`, body); }
    archive(row: AdminAccount, body: unknown) { return this.api.delete<null>(`admin/accounts/${row.employee_id}`, body); }
    events(row: AdminAccount, page: number) { return this.api.get<AdminAuditEvent[]>(`admin/accounts/${row.employee_id}/events`, { page }); }
}

export function accountError(error: unknown, locale: LocaleService): string {
    if (error instanceof HttpErrorResponse && [400, 409, 422].includes(error.status)) {
        const fields: unknown[] = Object.values(error.error?.errors ?? {}).flat();
        const message = fields.find(value => typeof value === 'string');
        if (typeof message === 'string') return message;
        if (typeof error.error?.message === 'string') return error.error.message;
    }
    return errorMessage(error, locale);
}

export function confirmed<T>(response: ApiEnvelope<T>): T {
    if (!response.success) throw new Error('Unconfirmed account operation');
    return response.data;
}

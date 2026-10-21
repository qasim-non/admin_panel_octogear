import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../../core/api-client';
import { TextKey } from '../../core/locale.service';

export const paymentStatuses = ['pending', 'paid', 'failed', 'refunded'] as const;
export const paymentMethods = ['cash', 'credit_card'] as const;
export type PaymentStatus = typeof paymentStatuses[number];
export type PaymentMethod = typeof paymentMethods[number];
export const paymentStatusKeys: Record<PaymentStatus, TextKey> = { pending: 'pending', paid: 'paid', failed: 'failedPayment', refunded: 'refundedPayment' };
export const paymentMethodKeys: Record<PaymentMethod, TextKey> = { cash: 'cashPayment', credit_card: 'cardPayment' };
export interface AdminPayment {
    id: number; order_id: number | null; amount: number; currency: 'SAR'; price_scale: 100;
    payment_method: PaymentMethod; payment_status: PaymentStatus; created_at: string; updated_at: string; archived: boolean;
    order: { id: number; available: boolean; type: 'general' | 'specific'; part_name: string | null;
        customer: { name: string; mobile: string; city: { id: number; name: string } | null } | null;
        store: { id: number; name: string } | null;
    } | null;
}
export interface PaymentFilters { search: string; order_id: number | null; city_id: number | null; status: string; method: string; type: string; date_from: string; date_to: string; page: number; }

@Injectable({ providedIn: 'root' })
export class PaymentApi {
    private readonly api = inject(ApiClient);
    list(filters: PaymentFilters) {
        const params: Record<string, string | number> = {};
        for (const [key, value] of Object.entries(filters)) if (value !== null && value !== '') params[key] = value;
        return this.api.get<AdminPayment[]>('admin/payments', params).pipe(map(response => {
            const m = response.meta;
            if (!response.success || !Array.isArray(response.data) || !m ||
                ![m.current_page, m.last_page, m.per_page].every(n => Number.isSafeInteger(n) && n > 0) || !Number.isSafeInteger(m.total) || m.total < 0 ||
                response.data.some(row => !row || !Number.isSafeInteger(row.id) || row.id <= 0 || !Number.isSafeInteger(row.amount) || row.amount < 0 ||
                    row.currency !== 'SAR' || row.price_scale !== 100 || !paymentStatuses.includes(row.payment_status) || !paymentMethods.includes(row.payment_method) ||
                    typeof row.archived !== 'boolean' || (row.order && (!['general', 'specific'].includes(row.order.type) || typeof row.order.available !== 'boolean')))) throw new Error('Invalid payments');
            return { payments: response.data, meta: m };
        }));
    }
}

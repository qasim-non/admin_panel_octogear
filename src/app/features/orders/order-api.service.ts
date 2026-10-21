import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient, errorMessage } from '../../core/api-client';
import { LocaleService, TextKey } from '../../core/locale.service';

export const orderStatuses = ['pending', 'rejected', 'awaiting_payment', 'paid', 'completed', 'cancelled'] as const;
export type OrderStatus = typeof orderStatuses[number];
export const statusKeys: Record<OrderStatus, TextKey> = { pending: 'pending', rejected: 'rejectedOrder', awaiting_payment: 'awaitingPayment', paid: 'paid', completed: 'completed', cancelled: 'cancelled' };
export interface OrderImage { id: number; url: string; }
interface Reference { id: number; name: string; }
export interface AdminOrder {
    id: number; order_type: 'general' | 'specific'; status: OrderStatus; created_at: string;
    currency: 'SAR'; price_scale: 100; quantity?: number; offered_price: number | null; requested_unit_price?: number | null;
    component_name?: string | null; description?: string | null; notes: string | null; accepted_offer_id: number | null;
    customer: { id: number | null; full_name: string | null; mobile: string | null; city: Reference | null } | null;
    accepted_store: (Reference & { city: Reference | null }) | null;
    store_car_component: { id: number; component_name: string | null; part_number: string | null; description: string | null; car_name: string | null; manufacturing_year: number | null } | null;
    vehicle_details: { car_name: string | null; company_name: string | null; manufacturing_year: number; color_name: string | null; fuel_type_name: string | null; transmission_type: string | null } | null;
    images: OrderImage[];
    offers: { id: number; price: number; status: string; notes: string | null; rejection_reason: string | null; store: Reference | null; images: OrderImage[]; created_at: string }[];
    payment?: { id: number; amount: number; payment_method: string; payment_status: string } | null;
}
export interface OrderFilters { customer: string; mobile: string; status: string; type: string; order_id: number | null; city_id: number | null; date_from: string; date_to: string; page: number; }
@Injectable({ providedIn: 'root' })
export class OrderApi {
    private readonly api = inject(ApiClient);
    list(filters: OrderFilters) {
        const params: Record<string, string | number> = {};
        for (const [key, value] of Object.entries(filters)) if (value !== null && value !== '') params[key] = value;
        return this.api.get<AdminOrder[]>('admin/orders', params).pipe(map(response => {
            if (!response.success || !Array.isArray(response.data) || !response.meta || response.data.some(row => !this.valid(row))) throw new Error('Invalid orders');
            return { orders: response.data, meta: response.meta };
        }));
    }
    get(id: number) {
        return this.api.get<AdminOrder>(`admin/orders/${id}`).pipe(map(response => {
            if (!response.success || response.data?.id !== id || !this.valid(response.data) || !Array.isArray(response.data.images) || !Array.isArray(response.data.offers)) throw new Error('Invalid order');
            return response.data;
        }));
    }
    private valid(order: AdminOrder): boolean { return order && orderStatuses.includes(order.status) && ['general', 'specific'].includes(order.order_type) && order.currency === 'SAR' && order.price_scale === 100; }
}
export function orderError(error: unknown, locale: LocaleService): string {
    if (error instanceof HttpErrorResponse && error.status === 403) return locale.t('ordersDenied');
    if (error instanceof HttpErrorResponse && error.status === 422) return locale.t('orderFiltersInvalid');
    return errorMessage(error, locale);
}
export function orderPart(order: AdminOrder): string | null { return (order.order_type === 'general' ? order.component_name : order.store_car_component?.component_name) ?? null; }
export function orderImagePath(url: string, kind: 'orders' | 'offers', id: number): string | null {
    const prefix = `/api/media/${kind}/${id}/images/`;
    return url?.startsWith(prefix) && /^\d+$/.test(url.slice(prefix.length)) ? url.slice('/api/'.length) : null;
}

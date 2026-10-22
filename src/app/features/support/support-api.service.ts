import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient, ApiEnvelope, PaginationMeta } from '../../core/api-client';

export type SupportStatus = 'open' | 'closed';
export interface SupportMessage { id: number; sender_kind: 'user' | 'admin'; content: string; client_message_id: string; created_at: string; }
export interface SupportConversation {
    id: number; version: number; status: SupportStatus; unread_count: number;
    user_read_through_id: number; support_read_through_id: number;
    user: { id: number; name: string | null; mobile: string | null; type: 'customer' | 'service provider' };
    last_message: SupportMessage | null; created_at: string; updated_at: string;
    last_activity_at: string | null; closed_at: string | null; reopened_at: string | null; closed_by: number | null;
}
export interface SupportPage { conversation: SupportConversation; messages: SupportMessage[]; has_more: boolean; }
export interface SupportReceipt { conversation: SupportConversation; message: SupportMessage; }
export interface SupportEvent { kind: 'message' | 'read' | 'status'; conversation: SupportConversation; message: SupportMessage | null; }
export interface SupportAudit { id: number; actor_kind: 'admin' | 'user'; actor_id: number; from_status: SupportStatus; to_status: SupportStatus; created_at: string; }
export interface SupportFilters { search: string; status: 'open' | 'closed' | 'all'; type: string; unread: string; page: number; }
export const emptySupportFilters = (): SupportFilters => ({ search: '', status: 'open', type: '', unread: '', page: 1 });
export function positiveId(value: unknown): number | null { const n = Number(value); return Number.isSafeInteger(n) && n > 0 ? n : null; }
export function supportQuery(f: SupportFilters): Record<string, string | number | null> {
    return { search: f.search || null, status: f.status === 'open' ? null : f.status, type: f.type || null, unread: f.unread || null, page: f.page === 1 ? null : f.page };
}
export function supportFilters(get: (key: string) => string | null): SupportFilters {
    const status = get('status');
    return { search: (get('search') ?? '').slice(0, 100), status: status === 'closed' || status === 'all' ? status : 'open',
        type: ['customer', 'service provider'].includes(get('type') ?? '') ? get('type')! : '', unread: get('unread') === 'true' ? 'true' : '', page: positiveId(get('page')) ?? 1 };
}

function record(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid support data');
    return value as Record<string, unknown>;
}
function integer(value: unknown, min = 0): number { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min) throw new Error('Invalid support number'); return value; }
function text(value: unknown): string { if (typeof value !== 'string') throw new Error('Invalid support text'); return value; }
function date(value: unknown): string { const s = text(value); if (!Number.isFinite(Date.parse(s))) throw new Error('Invalid support date'); return s; }
function status(value: unknown): SupportStatus { if (value !== 'open' && value !== 'closed') throw new Error('Invalid support status'); return value; }
function actor(value: unknown): 'admin' | 'user' { if (value !== 'admin' && value !== 'user') throw new Error('Invalid support actor'); return value; }
function message(value: unknown): SupportMessage {
    const m = record(value);
    return { id: integer(m['id'], 1), sender_kind: actor(m['sender_kind']), content: text(m['content']), client_message_id: text(m['client_message_id']), created_at: date(m['created_at']) };
}
export function parseConversation(value: unknown): SupportConversation {
    const c = record(value), u = record(c['user']);
    if (u['type'] !== 'customer' && u['type'] !== 'service provider') throw new Error('Invalid support account');
    return { id: integer(c['id'], 1), version: integer(c['version'], 1), status: status(c['status']), unread_count: integer(c['unread_count']),
        user_read_through_id: integer(c['user_read_through_id']), support_read_through_id: integer(c['support_read_through_id']),
        user: { id: integer(u['id'], 1), name: u['name'] === null ? null : text(u['name']), mobile: u['mobile'] === null ? null : text(u['mobile']), type: u['type'] },
        last_message: c['last_message'] === null ? null : message(c['last_message']), created_at: date(c['created_at']), updated_at: date(c['updated_at']),
        last_activity_at: c['last_activity_at'] === null ? null : date(c['last_activity_at']), closed_at: c['closed_at'] === null ? null : date(c['closed_at']),
        reopened_at: c['reopened_at'] === null ? null : date(c['reopened_at']), closed_by: c['closed_by'] === null ? null : integer(c['closed_by'], 1) };
}
export function parseSupportEvent(value: unknown): SupportEvent | null {
    try {
        const e = record(value), kind = e['kind'];
        if (kind !== 'message' && kind !== 'read' && kind !== 'status') return null;
        return { kind, conversation: parseConversation(e['conversation']), message: e['message'] == null ? null : message(e['message']) };
    } catch { return null; }
}
function data(response: ApiEnvelope<unknown>): unknown { if (!response.success) throw new Error('Unconfirmed support response'); return response.data; }
function pageMeta(m: PaginationMeta | undefined): PaginationMeta {
    if (!m) throw new Error('Missing support pagination');
    return { current_page: integer(m.current_page, 1), last_page: integer(m.last_page, 1), per_page: integer(m.per_page, 1), total: integer(m.total) };
}

@Injectable({ providedIn: 'root' })
export class SupportApi {
    private readonly api = inject(ApiClient);
    private readonly path = 'admin/support/conversations';
    list(filters: SupportFilters) {
        return this.api.get<unknown>(this.path, Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''))).pipe(map(r => {
            const rows = data(r); if (!Array.isArray(rows)) throw new Error('Invalid support list');
            return { rows: rows.map(parseConversation), meta: pageMeta(r.meta) };
        }));
    }
    timeline(id: number, cursor: { before_id?: number; after_id?: number } = {}) {
        return this.api.get<unknown>(`${this.path}/${id}/timeline`, cursor).pipe(map(r => {
            const p = record(data(r)); if (!Array.isArray(p['messages']) || typeof p['has_more'] !== 'boolean') throw new Error('Invalid support timeline');
            return { conversation: parseConversation(p['conversation']), messages: p['messages'].map(message), has_more: p['has_more'] } as SupportPage;
        }));
    }
    send(id: number, content: string, client_message_id: string) {
        return this.api.post<unknown>(`${this.path}/${id}/messages`, { content, client_message_id }).pipe(map(r => {
            const p = record(data(r)); return { conversation: parseConversation(p['conversation']), message: message(p['message']) } as SupportReceipt;
        }));
    }
    read(id: number, through_id: number) { return this.api.patch<unknown>(`${this.path}/${id}/read`, { through_id }).pipe(map(r => parseConversation(data(r)))); }
    status(id: number, next: SupportStatus, version: number) { return this.api.patch<unknown>(`${this.path}/${id}/status`, { status: next, version }).pipe(map(r => parseConversation(data(r)))); }
    audit(id: number, page: number) {
        return this.api.get<unknown>(`${this.path}/${id}/events`, { page }).pipe(map(r => {
            const rows = data(r); if (!Array.isArray(rows)) throw new Error('Invalid support history');
            return { rows: rows.map(value => { const e = record(value); return { id: integer(e['id'], 1), actor_kind: actor(e['actor_kind']), actor_id: integer(e['actor_id'], 1), from_status: status(e['from_status']), to_status: status(e['to_status']), created_at: date(e['created_at']) } as SupportAudit; }), meta: pageMeta(r.meta) };
        }));
    }
    configuration() {
        return this.api.get<unknown>('admin/support/realtime').pipe(map(r => {
            const c = record(data(r)); if (c['enabled'] === false) return null;
            if (c['enabled'] !== true) throw new Error('Invalid realtime configuration');
            const url = new URL(text(c['url'])), channel = text(c['channel']);
            if (url.username || url.password || url.search || url.hash || !url.pathname.startsWith('/app/') ||
                !(url.protocol === 'wss:' || (url.protocol === 'ws:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))) ||
                !/^private-support\.admin\.sessions\.[1-9]\d*$/.test(channel)) throw new Error('Invalid realtime configuration');
            url.searchParams.set('protocol', '7'); url.searchParams.set('client', 'octogear-admin'); url.searchParams.set('version', '1.0');
            return { url: url.toString(), channel };
        }));
    }
    authorize(socket_id: string, channel_name: string) {
        return this.api.post<unknown>('admin/support/realtime/auth', { socket_id, channel_name }).pipe(map(r => text(record(data(r))['auth'])));
    }
}

import { HttpErrorResponse } from '@angular/common/http';
import { effect, inject, Injectable, OnDestroy, signal } from '@angular/core';
import { firstValueFrom, Subject } from 'rxjs';
import { SessionService } from '../../core/session.service';
import { parseSupportEvent, SupportApi, SupportEvent } from './support-api.service';
import { SupportRealtimeConfig } from './support-realtime-config.service';

export type SupportConnection = 'connecting' | 'live' | 'offline' | 'disabled' | 'denied';
@Injectable()
export class SupportRealtime implements OnDestroy {
    private readonly api = inject(SupportApi); private readonly session = inject(SessionService);
    private readonly configuration = inject(SupportRealtimeConfig);
    readonly status = signal<SupportConnection>('connecting');
    readonly events = new Subject<SupportEvent | 'connected'>();
    private socket?: WebSocket; private generation = 0; private token: string | null = null; private disposed = false;
    private retryTimer?: ReturnType<typeof setTimeout>; private healthTimer?: ReturnType<typeof setTimeout>; private handshakeTimer?: ReturnType<typeof setTimeout>;
    private attempts = 0; private activity = 120000;
    private readonly visibility = () => { if (document.visibilityState === 'visible' && navigator.onLine) this.connect(); else this.stop(); };
    constructor() {
        effect(() => {
            this.session.profile(); const token = this.session.token();
            if (token === this.token) return;
            this.stop(); this.token = token; this.attempts = 0;
            if (token) this.connect();
        });
        document.addEventListener('visibilitychange', this.visibility);
        window.addEventListener('online', this.visibility); window.addEventListener('offline', this.visibility);
    }
    reconnect(): void {
        if (this.status() === 'connecting') return;
        this.configuration.clear(); this.stop(); this.attempts = 0; this.connect();
    }
    private current(g: number): boolean { return !this.disposed && g === this.generation && !!this.token && this.token === this.session.token(); }
    private connect(): void {
        if (this.disposed || !this.token || this.socket || this.status() === 'connecting' || document.visibilityState !== 'visible' || !navigator.onLine) return;
        clearTimeout(this.retryTimer); const g = ++this.generation; this.status.set('connecting');
        void this.open(g);
    }
    private async open(g: number): Promise<void> {
        let configured = false;
        try {
            const config = await this.configuration.get(); if (!this.current(g)) return;
            configured = true;
            if (!config) { this.status.set('disabled'); return; }
            const ws = new WebSocket(config.url); this.socket = ws;
            this.handshakeTimer = setTimeout(() => this.fail(g), 15000);
            let authorizing = false;
            ws.onmessage = event => {
                if (!this.current(g)) return;
                try {
                    const frame = JSON.parse(event.data as string);
                    const payload = typeof frame.data === 'string' ? JSON.parse(frame.data) : frame.data;
                    this.armHealth(g);
                    if (frame.event === 'pusher:connection_established' && !authorizing) {
                        if (!/^\d+\.\d+$/.test(payload?.socket_id)) { this.fail(g); return; }
                        authorizing = true;
                        if (typeof payload.activity_timeout === 'number' && payload.activity_timeout > 0) this.activity = Math.min(120000, payload.activity_timeout * 1000);
                        void firstValueFrom(this.api.authorize(payload.socket_id, config.channel)).then(auth => {
                            if (this.current(g) && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ event: 'pusher:subscribe', data: { channel: config.channel, auth } }));
                        }).catch(error => this.fail(g, error));
                    } else if (frame.event === 'pusher:ping') {
                        ws.send(JSON.stringify({ event: 'pusher:pong', data: {} }));
                    } else if (frame.event === 'pusher:error' || frame.event === 'pusher:subscription_error') {
                        this.fail(g);
                    } else if (frame.channel === config.channel && frame.event === 'pusher_internal:subscription_succeeded') {
                        clearTimeout(this.handshakeTimer); this.attempts = 0; this.status.set('live'); this.events.next('connected');
                    } else if (frame.channel === config.channel && frame.event === 'support.updated' && this.status() === 'live') {
                        const update = parseSupportEvent(payload); if (update) this.events.next(update);
                    }
                } catch { /* Ignore malformed frames; never expose transport contents in logs. */ }
            };
            ws.onerror = () => this.fail(g); ws.onclose = () => this.fail(g);
        } catch (error) { this.fail(g, error, configured); }
    }
    private armHealth(g: number): void {
        clearTimeout(this.healthTimer);
        this.healthTimer = setTimeout(() => {
            if (!this.current(g) || this.socket?.readyState !== WebSocket.OPEN) return;
            this.socket.send(JSON.stringify({ event: 'pusher:ping', data: {} }));
            this.healthTimer = setTimeout(() => this.fail(g), 30000);
        }, this.activity);
    }
    private fail(g: number, error?: unknown, retry = true): void {
        if (!this.current(g)) return;
        this.stop();
        if (error instanceof HttpErrorResponse && [401, 403].includes(error.status)) { this.status.set('denied'); return; }
        if (!retry || this.disposed || !this.token || document.visibilityState !== 'visible' || !navigator.onLine) return;
        this.retryTimer = setTimeout(() => this.connect(), Math.min(30000, 1000 * 2 ** Math.min(this.attempts++, 5)) + Math.random() * 250);
    }
    private stop(): void {
        ++this.generation; clearTimeout(this.retryTimer); clearTimeout(this.healthTimer); clearTimeout(this.handshakeTimer);
        const socket = this.socket; this.socket = undefined;
        if (socket) { socket.onclose = socket.onerror = socket.onmessage = null; socket.close(); }
        this.status.set('offline');
    }
    ngOnDestroy(): void {
        this.disposed = true; this.stop(); this.events.complete();
        document.removeEventListener('visibilitychange', this.visibility); window.removeEventListener('online', this.visibility); window.removeEventListener('offline', this.visibility);
    }
}

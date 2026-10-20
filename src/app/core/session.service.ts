import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { ApiClient } from './api-client';
import { AppSettings } from './app-settings';

export interface AdminProfile { employee_id: number; name: string; email: string; assigned_role: string; status: string; }

@Injectable({ providedIn: 'root' })
export class SessionService {
    private readonly api = inject(ApiClient);
    private readonly router = inject(Router);
    private readonly settings = inject(AppSettings);
    private readonly storageKey = 'octogear.admin.session';
    private restoring = false;
    private bearer: string | null = null;
    private generation = 0;
    readonly profile = signal<AdminProfile | null>(null);
    readonly ended = signal(false);
    readonly busy = signal(false);
    readonly restoreFailed = signal(false);
    token(): string | null { return this.bearer; }

    async restore(): Promise<void> {
        if (this.settings.error()) return;
        try {
            const saved = JSON.parse(sessionStorage.getItem(this.storageKey) ?? 'null');
            if (!saved) return;
            if (saved.apiBaseUrl !== this.settings.apiBaseUrl() || typeof saved.token !== 'string' || !saved.token) {
                this.forgetSavedSession();
                return;
            }
            this.bearer = saved.token;
        } catch { this.forgetSavedSession(); return; }
        this.restoring = true;
        const generation = this.generation;
        try {
            const identity = await this.readIdentity();
            if (generation === this.generation) this.profile.set(identity);
        } catch (error) {
            if (error instanceof HttpErrorResponse && [401, 403].includes(error.status)) this.clear(true);
            else {
                // Connection failures do not revoke a saved session or expose the protected UI.
                this.bearer = null;
                this.restoreFailed.set(true);
            }
        } finally { this.restoring = false; }
    }

    async login(email: string, password: string): Promise<boolean> {
        if (this.busy()) return false;
        this.busy.set(true);
        const generation = ++this.generation;
        try {
            const result = await firstValueFrom(this.api.post<{ token: string }>('auth/admin/login', { email, password }).pipe(timeout(20000)));
            if (generation !== this.generation) return false;
            if (!result.success || !result.data?.token) throw new Error('Invalid login response');
            this.bearer = result.data.token;
            const identity = await this.readIdentity();
            if (generation !== this.generation) return false;
            this.profile.set(identity);
            try { sessionStorage.setItem(this.storageKey, JSON.stringify({ apiBaseUrl: this.settings.apiBaseUrl(), token: this.bearer })); }
            catch { /* Storage may be disabled; this login still works in memory. */ }
            this.ended.set(false);
            return true;
        } catch (error) {
            // A successful login followed by a failed identity check must not leave an authenticated UI.
            if (generation === this.generation) this.clear(false);
            throw error;
        } finally { this.busy.set(false); }
    }

    async logout(): Promise<void> {
        if (this.busy()) return;
        this.busy.set(true);
        try {
            await firstValueFrom(this.api.post<null>('auth/logout', {}).pipe(timeout(20000)));
            this.clear(false);
            await this.router.navigateByUrl('/login');
        } finally { this.busy.set(false); }
    }

    expire(expectedToken: string): void {
        if (this.bearer !== expectedToken) return;
        this.clear(true);
        if (!this.restoring) void this.router.navigateByUrl('/login');
    }

    private async readIdentity(): Promise<AdminProfile> {
        const identity = await firstValueFrom(this.api.get<AdminProfile>('admin/profile').pipe(timeout(20000)));
        if (!identity.success || !identity.data?.employee_id) throw new Error('Invalid identity response');
        return identity.data;
    }

    private forgetSavedSession(): void {
        try { sessionStorage.removeItem(this.storageKey); } catch { /* Storage may be disabled. */ }
    }

    private clear(ended: boolean): void {
        ++this.generation;
        this.bearer = null;
        this.forgetSavedSession();
        this.profile.set(null);
        this.ended.set(ended);
    }
}

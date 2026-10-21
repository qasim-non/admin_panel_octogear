import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { ApiClient } from './api-client';
import { AppSettings } from './app-settings';
import { Language, LocaleService } from './locale.service';

export interface AdminProfile { employee_id: number; name: string; email: string; assigned_role: string; status: string; preferred_language?: Language | null; }

@Injectable({ providedIn: 'root' })
export class SessionService {
    private readonly api = inject(ApiClient);
    private readonly router = inject(Router);
    private readonly settings = inject(AppSettings);
    private readonly locale = inject(LocaleService);
    private readonly storageKey = 'octogear.admin.session';
    private restoring = false;
    private bearer: string | null = null;
    private generation = 0;
    readonly profile = signal<AdminProfile | null>(null);
    readonly ended = signal(false);
    readonly busy = signal(false);
    readonly restoreFailed = signal(false);
    readonly languageSaving = signal(false);
    readonly languageSaveFailed = signal(false);
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
            if (generation === this.generation) this.acceptIdentity(identity);
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
            const result = await firstValueFrom(this.api.post<{ token: string }>('auth/admin/login', { email, password, preferred_language: this.locale.language() }).pipe(timeout(20000)));
            if (generation !== this.generation) return false;
            if (!result.success || !result.data?.token) throw new Error('Invalid login response');
            this.bearer = result.data.token;
            const identity = await this.readIdentity();
            if (generation !== this.generation) return false;
            this.acceptIdentity(identity);
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
        if (this.busy() || this.languageSaving()) return;
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

    async toggleLanguage(): Promise<void> {
        if (!this.profile() || this.busy() || this.languageSaving()) return;
        const generation = this.generation;
        const language: Language = this.locale.language() === 'en' ? 'ar' : 'en';
        this.languageSaving.set(true); this.languageSaveFailed.set(false);
        try {
            const result = await firstValueFrom(this.api.patch<{ preferred_language: Language }>('admin/profile/language', { preferred_language: language }));
            if (generation !== this.generation) return;
            if (!result.success || result.data?.preferred_language !== language) throw new Error('Unconfirmed preference');
            this.profile.update(profile => profile ? { ...profile, preferred_language: language } : null);
            this.locale.set(language);
        } catch {
            if (generation === this.generation) this.languageSaveFailed.set(true);
        } finally { if (generation === this.generation) this.languageSaving.set(false); }
    }

    private acceptIdentity(identity: AdminProfile): void {
        this.profile.set(identity);
        if (identity.preferred_language === 'ar' || identity.preferred_language === 'en') this.locale.set(identity.preferred_language);
    }

    private forgetSavedSession(): void {
        try { sessionStorage.removeItem(this.storageKey); } catch { /* Storage may be disabled. */ }
    }

    private clear(ended: boolean): void {
        ++this.generation;
        this.bearer = null;
        this.forgetSavedSession();
        this.profile.set(null);
        this.languageSaving.set(false); this.languageSaveFailed.set(false);
        this.ended.set(ended);
    }
}

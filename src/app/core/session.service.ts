import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { ApiClient } from './api-client';
import { AppSettings } from './app-settings';
import { Language, LocaleService } from './locale.service';

export interface AdminProfile { employee_id: number; name: string; email: string; assigned_role: string; status: string; preferred_language?: Language | null; permissions: string[]; password_changed_at?: string | null; }

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
    private setupChallenge: string | null = null;
    readonly needsPasswordSetup = signal(false);
    readonly profile = signal<AdminProfile | null>(null);
    readonly ended = signal(false);
    readonly busy = signal(false);
    readonly restoreFailed = signal(false);
    readonly languageSaving = signal(false);
    readonly languageSaveFailed = signal(false);
    token(): string | null { return this.bearer; }
    can(permission: string): boolean { return this.profile()?.permissions?.includes(permission) ?? false; }
    home(): string {
        const pages = [['dashboard.view', '/overview'], ['users.view', '/customers'], ['support.access', '/chats'], ['admins.view', '/sub-admins'], ['catalog.view', '/car-companies']];
        return pages.find(([permission]) => this.can(permission))?.[1] ?? '/settings';
    }
    cancelSetup(): void { this.setupChallenge = null; this.needsPasswordSetup.set(false); }

    async completePasswordSetup(password: string, password_confirmation: string): Promise<boolean> {
        if (this.busy() || !this.setupChallenge) return false;
        this.busy.set(true);
        const generation = ++this.generation;
        try {
            const response = await firstValueFrom(this.api.post<{ token: string }>('auth/admin/password-setup', { challenge: this.setupChallenge, password, password_confirmation }));
            if (generation !== this.generation) return false;
            if (!response.success || !response.data?.token) throw new Error('Invalid setup response');
            return await this.startSession(response.data.token, generation);
        } catch (error) {
            if (this.bearer && generation === this.generation) this.clear(false);
            throw error;
        } finally { this.busy.set(false); }
    }

    async changePassword(current_password: string, password: string, password_confirmation: string): Promise<void> {
        if (this.busy()) return;
        this.busy.set(true);
        try {
            const response = await firstValueFrom(this.api.patch<null>('admin/profile/password', { current_password, password, password_confirmation }));
            if (!response.success) throw new Error('Unconfirmed password change');
            this.clear(false);
            await this.router.navigateByUrl('/login?passwordChanged=1');
        } finally { this.busy.set(false); }
    }

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
            const result = await firstValueFrom(this.api.post<{ token?: string; requires_password_change?: boolean; challenge?: string }>('auth/admin/login', { email, password, preferred_language: this.locale.language() }).pipe(timeout(20000)));
            if (generation !== this.generation) return false;
            if (result.success && result.data?.requires_password_change && /^[a-f0-9]{64}$/.test(result.data.challenge ?? '')) {
                this.bearer = null; this.forgetSavedSession(); this.profile.set(null);
                this.setupChallenge = result.data.challenge!; this.needsPasswordSetup.set(true);
                return false;
            }
            if (!result.success || !result.data?.token) throw new Error('Invalid login response');
            return await this.startSession(result.data.token, generation);
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
        if (!identity.success || !identity.data?.employee_id || !Array.isArray(identity.data.permissions)) throw new Error('Invalid identity response');
        return identity.data;
    }

    private async startSession(token: string, generation: number): Promise<boolean> {
        this.bearer = token;
        const identity = await this.readIdentity();
        if (generation !== this.generation) return false;
        this.acceptIdentity(identity); this.cancelSetup();
        try { sessionStorage.setItem(this.storageKey, JSON.stringify({ apiBaseUrl: this.settings.apiBaseUrl(), token })); }
        catch { /* Login remains available in memory if storage is disabled. */ }
        this.ended.set(false);
        return true;
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
        this.cancelSetup();
        this.languageSaving.set(false); this.languageSaveFailed.set(false);
        this.ended.set(ended);
    }
}

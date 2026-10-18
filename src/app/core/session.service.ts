import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom, timeout } from 'rxjs';
import { ApiClient } from './api-client';

export interface AdminProfile { employee_id: number; name: string; email: string; assigned_role: string; status: string; }

@Injectable({ providedIn: 'root' })
export class SessionService {
    private readonly api = inject(ApiClient);
    private readonly router = inject(Router);
    private bearer: string | null = null;
    private generation = 0;
    readonly profile = signal<AdminProfile | null>(null);
    readonly ended = signal(false);
    readonly busy = signal(false);
    token(): string | null { return this.bearer; }

    async login(email: string, password: string): Promise<boolean> {
        if (this.busy()) return false;
        this.busy.set(true);
        const generation = ++this.generation;
        try {
            const result = await firstValueFrom(this.api.post<{ token: string }>('auth/admin/login', { email, password }).pipe(timeout(20000)));
            if (generation !== this.generation) return false;
            if (!result.success || !result.data?.token) throw new Error('Invalid login response');
            this.bearer = result.data.token;
            const identity = await firstValueFrom(this.api.get<AdminProfile>('admin/profile').pipe(timeout(20000)));
            if (generation !== this.generation) return false;
            if (!identity.success || !identity.data?.employee_id) throw new Error('Invalid identity response');
            this.profile.set(identity.data);
            this.ended.set(false);
            return true;
        } catch (error) {
            // A successful login followed by a failed identity check must not leave an authenticated UI.
            if (generation === this.generation) { this.bearer = null; this.profile.set(null); }
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
        void this.router.navigateByUrl('/login');
    }

    private clear(ended: boolean): void {
        ++this.generation;
        this.bearer = null;
        this.profile.set(null);
        this.ended.set(ended);
    }
}

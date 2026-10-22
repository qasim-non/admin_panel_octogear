import { effect, inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppSettings } from '../../core/app-settings';
import { SessionService } from '../../core/session.service';
import { SupportApi } from './support-api.service';

/** One configuration attempt per signed-in page session, including disabled/error results. */
@Injectable({ providedIn: 'root' })
export class SupportRealtimeConfig {
    private readonly api = inject(SupportApi); private readonly session = inject(SessionService); private readonly settings = inject(AppSettings);
    private cached?: { token: string; base: string; request: Promise<{ url: string; channel: string } | null> };
    constructor() {
        effect(() => {
            this.session.profile();
            const token = this.session.token(), base = this.settings.apiBaseUrl();
            if (this.cached && (this.cached.token !== token || this.cached.base !== base)) this.clear();
        });
    }
    get(): Promise<{ url: string; channel: string } | null> {
        const token = this.session.token(), base = this.settings.apiBaseUrl();
        if (!token) { this.clear(); return Promise.resolve(null); }
        if (!this.cached || this.cached.token !== token || this.cached.base !== base) {
            this.cached = { token, base, request: firstValueFrom(this.api.configuration()) };
        }
        return this.cached.request;
    }
    clear(): void { this.cached = undefined; }
}

import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AppSettings {
    readonly apiBaseUrl = signal('');
    readonly error = signal(false);

    async load(): Promise<void> {
        try {
            const response = await fetch('app-config.json', { cache: 'no-store' });
            if (!response.ok) throw new Error('Configuration unavailable');
            const config: unknown = await response.json();
            const value = (config as { apiBaseUrl?: unknown })?.apiBaseUrl;
            if (typeof value !== 'string') throw new Error('Invalid API configuration');
            const url = new URL(value);
            if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Invalid API URL');
            if (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('HTTPS required');
            this.apiBaseUrl.set(url.href.replace(/\/+$/, ''));
        } catch { this.error.set(true); }
    }
}

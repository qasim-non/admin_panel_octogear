import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { AppSettings } from './app-settings';
import { LocaleService } from './locale.service';
import { throwError, TimeoutError } from 'rxjs';

export interface PaginationMeta { current_page: number; last_page: number; per_page: number; total: number; }
export interface ApiEnvelope<T> { success: boolean; message: string; data: T; meta?: PaginationMeta; }

@Injectable({ providedIn: 'root' })
export class ApiClient {
    private readonly http = inject(HttpClient);
    private readonly settings = inject(AppSettings);
    get<T>(path: string, params: Record<string, string | number> = {}) {
        return this.http.get<ApiEnvelope<T>>(`${this.settings.apiBaseUrl()}/${path}`, { params });
    }
    patch<T>(path: string, body: unknown) { return this.http.patch<ApiEnvelope<T>>(`${this.settings.apiBaseUrl()}/${path}`, body); }
    post<T>(path: string, body: unknown) { return this.http.post<ApiEnvelope<T>>(`${this.settings.apiBaseUrl()}/${path}`, body); }
    delete<T>(path: string, body: unknown) { return this.http.delete<ApiEnvelope<T>>(`${this.settings.apiBaseUrl()}/${path}`, { body }); }
    image(path: string) {
        if (!/^media\/[a-z0-9/-]+$/.test(path)) return throwError(() => new Error('Invalid media path'));
        return this.http.get(`${this.settings.apiBaseUrl()}/${path}`, { responseType: 'blob' });
    }
}

export function errorMessage(error: unknown, locale: LocaleService): string {
    if (error instanceof TimeoutError) return locale.t('connectionError');
    if (!(error instanceof HttpErrorResponse)) return locale.t('unknownError');
    if (error.status === 0) return locale.t('connectionError');
    if (error.status === 401) return locale.t('loginError');
    if (error.status === 403) return locale.t('blocked');
    if (error.status === 429) return locale.t('tooMany');
    return locale.t('unknownError');
}

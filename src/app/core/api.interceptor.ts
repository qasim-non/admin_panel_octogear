import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError, timeout } from 'rxjs';
import { AppSettings } from './app-settings';
import { LocaleService } from './locale.service';
import { SessionService } from './session.service';

export const apiInterceptor: HttpInterceptorFn = (request, next) => {
    const settings = inject(AppSettings);
    const locale = inject(LocaleService);
    const session = inject(SessionService);
    const base = settings.apiBaseUrl();
    if (!base || !request.url.startsWith(`${base}/`)) return next(request);
    const token = session.token();
    const headers: Record<string, string> = { Accept: 'application/json', 'Accept-Language': locale.language() };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return next(request.clone({ setHeaders: headers })).pipe(timeout(25000), catchError(error => {
        if (token && error instanceof HttpErrorResponse && error.status === 401) session.expire(token);
        return throwError(() => error);
    }));
};

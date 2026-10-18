import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, inject, provideAppInitializer, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { AppSettings } from './app/core/app-settings';
import { apiInterceptor } from './app/core/api.interceptor';
import { OctoGearPreset } from './app/core/octogear-preset';
import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
    providers: [
        provideZonelessChangeDetection(),
        provideRouter(appRoutes, withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })),
        provideHttpClient(withFetch(), withInterceptors([apiInterceptor])),
        provideAppInitializer(() => inject(AppSettings).load()),
        providePrimeNG({ theme: { preset: OctoGearPreset, options: { darkModeSelector: false } }, ripple: false })
    ]
};

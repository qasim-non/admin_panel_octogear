import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, combineLatest, map, of, switchMap } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { RouterLink } from '@angular/router';
import { StoreStatusComponent } from '../stores/store-status.component';
import { errorMessage, PaginationMeta } from '../../core/api-client';
import { LocaleService } from '../../core/locale.service';
import { AdminStore, StoreApi } from '../stores/store-api.service';

@Component({
    selector: 'app-provider-stores',
    imports: [ButtonModule, MessageModule, SkeletonModule, TableModule, RouterLink, StoreStatusComponent],
    templateUrl: './provider-stores.component.html',
    styleUrl: '../users/users.scss',
    styles: [':host { margin-top: 24px; } .store-summary { padding: 0 24px 24px; } .store-name { font-weight: 600; overflow-wrap: anywhere; }']
})
export class ProviderStoresComponent {
    readonly providerId = input.required<number>();
    readonly locale = inject(LocaleService);
    private readonly api = inject(StoreApi);
    private readonly request = signal<{ page: number; revision: number } | null>(null);
    readonly opened = signal(false);
    readonly loading = signal(false);
    readonly error = signal('');
    readonly rows = signal<AdminStore[]>([]);
    readonly meta = signal<PaginationMeta | null>(null);

    constructor() {
        combineLatest([toObservable(this.providerId), toObservable(this.locale.language), toObservable(this.request)]).pipe(
            switchMap(([id, , request]) => {
                if (!request) return of(null);
                this.loading.set(true); this.error.set(''); this.rows.set([]); this.meta.set(null);
                return this.api.list({ owner_id: id, page: request.page }).pipe(
                    map(result => ({ result, error: '' })),
                    catchError(error => of({ result: null, error: error instanceof HttpErrorResponse && error.status === 403
                        ? this.locale.t('storesAccessDenied') : errorMessage(error, this.locale) }))
                );
            }), takeUntilDestroyed()
        ).subscribe(response => {
            if (!response) return;
            if (response.result && response.result.meta.current_page > response.result.meta.last_page) {
                this.load(Math.max(1, response.result.meta.last_page));
                return;
            }
            this.rows.set(response.result?.stores ?? []); this.meta.set(response.result?.meta ?? null);
            this.error.set(response.error); this.loading.set(false);
        });
    }

    show(): void { if (!this.opened()) { this.opened.set(true); this.load(1); } }
    refresh(): void { if (!this.loading()) this.load(this.request()?.page ?? 1); }
    changePage(page: number): void {
        if (!this.loading() && page >= 1 && page <= (this.meta()?.last_page ?? 1)) this.load(page);
    }
    number(value: number): string { return new Intl.NumberFormat(this.locale.language()).format(value); }
    private load(page: number): void { this.request.update(value => ({ page, revision: (value?.revision ?? 0) + 1 })); }
}

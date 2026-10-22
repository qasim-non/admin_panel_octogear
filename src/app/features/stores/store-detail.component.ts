import { SessionService } from '../../core/session.service';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, combineLatest, filter, map, of, switchMap } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { LocaleService } from '../../core/locale.service';
import { PrivateImageComponent } from '../../shared/private-image.component';
import { locationLink, storeMediaPath } from '../../shared/store-links';
import { userDate } from '../users/user-api.service';
import { StoreApi, StoreDetail, StoreStatus, storeError } from './store-api.service';
import { StoreStatusComponent } from './store-status.component';

@Component({
    selector: 'app-store-detail',
    imports: [RouterLink, ButtonModule, DialogModule, MessageModule, SkeletonModule, PrivateImageComponent, StoreStatusComponent],
    templateUrl: './store-detail.component.html', styleUrls: ['../users/users.scss', './stores.scss']
})
export class StoreDetailComponent {
    readonly session = inject(SessionService);
    readonly locale = inject(LocaleService);
    private readonly route = inject(ActivatedRoute);
    private readonly api = inject(StoreApi);
    private readonly destroyRef = inject(DestroyRef);
    private readonly reload = signal(0);
    readonly data = signal<StoreDetail | null>(null);
    readonly loading = signal(true);
    readonly error = signal('');
    readonly unavailable = signal(false);
    readonly saving = signal(false);
    readonly confirmVisible = signal(false);
    readonly needsRefresh = signal(false);
    readonly mutationError = signal('');
    readonly updated = signal(false);
    readonly safeLocation = locationLink;
    readonly mediaPath = storeMediaPath;
    date(value: string): string { return userDate(value, this.locale.language(), true); }
    number(value: number): string { return new Intl.NumberFormat(this.locale.language(), { maximumFractionDigits: 1 }).format(value); }
    constructor() {
        combineLatest([this.route.paramMap, toObservable(this.locale.language), toObservable(this.reload)]).pipe(
            filter(() => !this.saving()),
            switchMap(([params]) => {
                const id = Number(params.get('id'));
                this.loading.set(true); this.error.set(''); this.unavailable.set(false); this.data.set(null); this.confirmVisible.set(false);
                if (!Number.isSafeInteger(id) || id <= 0) return of({ data: null, unavailable: true, error: '' });
                return this.api.get(id).pipe(map(data => ({ data, unavailable: false, error: '' })),
                    catchError(error => of({ data: null, unavailable: error instanceof HttpErrorResponse && error.status === 404, error: storeError(error, this.locale) })));
            }), takeUntilDestroyed()
        ).subscribe(result => {
            this.data.set(result.data); this.unavailable.set(result.unavailable); this.error.set(result.error); this.loading.set(false);
            if (result.data) { this.needsRefresh.set(false); this.mutationError.set(''); }
        });
    }
    refresh(): void { if (!this.saving()) { this.confirmVisible.set(false); this.reload.update(value => value + 1); } }
    ask(): void {
        if (!this.data() || this.saving() || this.needsRefresh()) return;
        this.updated.set(false); this.mutationError.set(''); this.confirmVisible.set(true);
    }
    confirm(): void {
        const store = this.data();
        if (!store || !this.confirmVisible() || this.saving() || this.needsRefresh()) return;
        const status: StoreStatus = store.status === 'active' ? 'inactive' : 'active';
        this.saving.set(true);
        this.api.setStatus(store.id, status).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: () => { this.saving.set(false); this.confirmVisible.set(false); this.updated.set(true); this.refresh(); },
            error: error => {
                this.saving.set(false); this.needsRefresh.set(true);
                this.mutationError.set(error instanceof HttpErrorResponse && error.status === 403 ? this.locale.t('storeManagementDenied') : this.locale.t('storeStatusUncertain'));
            }
        });
    }
}

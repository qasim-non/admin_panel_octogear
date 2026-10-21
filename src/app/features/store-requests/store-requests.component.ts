import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, combineLatest, map, of, switchMap } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { PaginationMeta } from '../../core/api-client';
import { LocaleService } from '../../core/locale.service';
import { CitySelectComponent } from '../../shared/city-select.component';
import { userDate } from '../users/user-api.service';
import { RequestFilters, requestError, RequestStatus, RequestType, StoreRequest, StoreRequestApi } from './store-request-api.service';
import { RequestStatusComponent } from './request-status.component';

@Component({
    selector: 'app-store-requests',
    imports: [ReactiveFormsModule, RouterLink, ButtonModule, InputTextModule, MessageModule, SelectModule, SkeletonModule, TableModule, CitySelectComponent, RequestStatusComponent],
    templateUrl: './store-requests.component.html', styleUrls: ['../users/users.scss', './store-requests.scss']
})
export class StoreRequestsComponent {
    readonly locale = inject(LocaleService);
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly api = inject(StoreRequestApi);
    private readonly reload = signal(0);
    readonly loading = signal(true);
    readonly error = signal('');
    readonly rows = signal<StoreRequest[]>([]);
    readonly meta = signal<PaginationMeta | null>(null);
    readonly filters = signal<RequestFilters>({ search: '', status: 'pending', request_type: '', city_id: null, page: 1 });
    readonly form = new FormGroup({
        search: new FormControl('', { nonNullable: true, validators: Validators.maxLength(100) }),
        status: new FormControl<RequestStatus | ''>('pending', { nonNullable: true }),
        request_type: new FormControl<RequestType | ''>('', { nonNullable: true }),
        city_id: new FormControl<number | null>(null)
    });
    readonly statuses = computed(() => [
        { label: this.locale.t('allStatuses'), value: '' }, { label: this.locale.t('pending'), value: 'pending' },
        { label: this.locale.t('requestAccepted'), value: 'accepted' }, { label: this.locale.t('requestRejected'), value: 'rejected' }
    ]);
    readonly types = computed(() => [
        { label: this.locale.t('allRequestTypes'), value: '' }, { label: this.locale.t('newStore'), value: 'new_store' },
        { label: this.locale.t('storeChange'), value: 'store_change' }
    ]);
    readonly query = computed(() => this.queryFor(this.filters()));
    readonly knownCity = computed(() => this.rows().find(row => row.city?.id === this.filters().city_id)?.city ?? null);
    readonly rangeStart = computed(() => this.rows().length ? ((this.meta()?.current_page ?? 1) - 1) * (this.meta()?.per_page ?? 15) + 1 : 0);
    readonly rangeEnd = computed(() => this.rows().length ? this.rangeStart() + this.rows().length - 1 : 0);
    number(value: number): string { return new Intl.NumberFormat(this.locale.language()).format(value); }
    date(value: string): string { return userDate(value, this.locale.language()); }

    constructor() {
        combineLatest([this.route.queryParamMap, toObservable(this.locale.language), toObservable(this.reload)]).pipe(
            switchMap(([params]) => {
                const page = Number(params.get('page') ?? 1), cityId = Number(params.get('city_id'));
                const status = params.get('status'), type = params.get('request_type');
                const filters: RequestFilters = {
                    search: (params.get('search') ?? '').slice(0, 100),
                    status: status === 'all' ? '' : status === 'accepted' || status === 'rejected' ? status : 'pending',
                    request_type: type === 'new_store' || type === 'store_change' ? type : '',
                    city_id: Number.isSafeInteger(cityId) && cityId > 0 ? cityId : null,
                    page: Number.isSafeInteger(page) && page > 0 ? page : 1
                };
                this.filters.set(filters); this.form.reset(filters);
                this.loading.set(true); this.error.set(''); this.rows.set([]); this.meta.set(null);
                return this.api.list(filters).pipe(map(result => ({ result, error: '' })), catchError(error => of({ result: null, error: requestError(error, this.locale) })));
            }), takeUntilDestroyed()
        ).subscribe(({ result, error }) => {
            if (result && result.meta.current_page > result.meta.last_page) { this.navigate({ ...this.filters(), page: Math.max(1, result.meta.last_page) }, true); return; }
            this.rows.set(result?.rows ?? []); this.meta.set(result?.meta ?? null); this.error.set(error); this.loading.set(false);
        });
    }
    apply(): void { if (this.form.valid) { const f = this.form.getRawValue(); this.navigate({ ...f, search: f.search.trim(), page: 1 }); } }
    clear(): void { this.navigate({ search: '', status: '', request_type: '', city_id: null, page: 1 }); }
    refresh(): void { this.reload.update(value => value + 1); }
    changePage(page: number): void { if (!this.loading() && page > 0 && page <= (this.meta()?.last_page ?? 1)) this.navigate({ ...this.filters(), page }); }
    private queryFor(f: RequestFilters) { return { search: f.search || null, status: f.status || 'all', request_type: f.request_type || null, city_id: f.city_id, page: f.page > 1 ? f.page : null }; }
    private navigate(filters: RequestFilters, replaceUrl = false): void {
        if (JSON.stringify(filters) === JSON.stringify(this.filters())) { this.refresh(); return; }
        void this.router.navigate([], { relativeTo: this.route, queryParams: this.queryFor(filters), replaceUrl });
    }
}

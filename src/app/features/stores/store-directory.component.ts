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
import { AdminStore, StoreApi, StoreFilters, StoreStatus, storeError } from './store-api.service';
import { StoreStatusComponent } from './store-status.component';

@Component({
    selector: 'app-store-directory',
    imports: [ReactiveFormsModule, RouterLink, ButtonModule, InputTextModule, MessageModule, SelectModule, SkeletonModule, TableModule, CitySelectComponent, StoreStatusComponent],
    templateUrl: './store-directory.component.html', styleUrls: ['../users/users.scss', './stores.scss']
})
export class StoreDirectoryComponent {
    readonly locale = inject(LocaleService);
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly api = inject(StoreApi);
    private readonly reload = signal(0);
    readonly rows = signal<AdminStore[]>([]);
    readonly meta = signal<PaginationMeta | null>(null);
    readonly loading = signal(true);
    readonly error = signal('');
    readonly filters = signal<StoreFilters>({ page: 1 });
    readonly form = new FormGroup({
        name: new FormControl('', { nonNullable: true, validators: Validators.maxLength(100) }),
        mobile: new FormControl('', { nonNullable: true, validators: Validators.maxLength(20) }),
        status: new FormControl<StoreStatus | ''>('', { nonNullable: true }),
        city_id: new FormControl<number | null>(null)
    });
    readonly statuses = computed(() => [
        { label: this.locale.t('allStatuses'), value: '' }, { label: this.locale.t('activeStore'), value: 'active' },
        { label: this.locale.t('inactiveStore'), value: 'inactive' }
    ]);
    readonly knownCity = computed(() => this.rows().find(row => row.city?.id === this.filters().city_id)?.city ?? null);
    readonly query = computed(() => this.queryFor(this.filters()));
    readonly rangeStart = computed(() => this.rows().length ? ((this.meta()?.current_page ?? 1) - 1) * (this.meta()?.per_page ?? 15) + 1 : 0);
    readonly rangeEnd = computed(() => this.rows().length ? this.rangeStart() + this.rows().length - 1 : 0);
    number(value: number): string { return new Intl.NumberFormat(this.locale.language()).format(value); }
    date(value: string): string { return userDate(value, this.locale.language()); }
    constructor() {
        combineLatest([this.route.queryParamMap, toObservable(this.locale.language), toObservable(this.reload)]).pipe(
            switchMap(([params]) => {
                const status = params.get('status');
                const f: StoreFilters = {
                    name: (params.get('name') ?? '').slice(0, 100), mobile: (params.get('mobile') ?? '').slice(0, 20),
                    status: status === 'active' || status === 'inactive' ? status : '',
                    city_id: this.positiveId(params.get('city_id')), owner_id: this.positiveId(params.get('owner_id')),
                    page: this.positiveId(params.get('page')) ?? 1
                };
                this.filters.set(f); this.form.reset({ name: f.name, mobile: f.mobile, status: f.status, city_id: f.city_id });
                this.rows.set([]); this.meta.set(null); this.loading.set(true); this.error.set('');
                return this.api.list(f).pipe(map(result => ({ result, error: '' })), catchError(error => of({ result: null, error: storeError(error, this.locale) })));
            }), takeUntilDestroyed()
        ).subscribe(({ result, error }) => {
            if (result && result.meta.current_page > result.meta.last_page) { this.navigate({ ...this.filters(), page: Math.max(1, result.meta.last_page) }, true); return; }
            this.rows.set(result?.stores ?? []); this.meta.set(result?.meta ?? null); this.error.set(error); this.loading.set(false);
        });
    }
    apply(): void {
        if (this.form.invalid) return;
        const f = this.form.getRawValue();
        this.navigate({ ...f, name: f.name.trim(), mobile: f.mobile.trim(), owner_id: this.filters().owner_id, page: 1 });
    }
    clear(): void { this.navigate({ name: '', mobile: '', status: '', city_id: null, owner_id: null, page: 1 }); }
    refresh(): void { this.reload.update(value => value + 1); }
    changePage(page: number): void { if (!this.loading() && page > 0 && page <= (this.meta()?.last_page ?? 1)) this.navigate({ ...this.filters(), page }); }
    private positiveId(value: string | null): number | null { const id = Number(value); return Number.isSafeInteger(id) && id > 0 ? id : null; }
    private queryFor(f: StoreFilters) { return { name: f.name || null, mobile: f.mobile || null, status: f.status || null, city_id: f.city_id, owner_id: f.owner_id, page: f.page > 1 ? f.page : null }; }
    private navigate(filters: StoreFilters, replaceUrl = false): void {
        if (JSON.stringify(filters) === JSON.stringify(this.filters())) { this.refresh(); return; }
        void this.router.navigate([], { relativeTo: this.route, queryParams: this.queryFor(filters), replaceUrl });
    }
}

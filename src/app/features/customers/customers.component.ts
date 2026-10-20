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
import { Customer, CustomerApi, CustomerFilters, CustomerStatus, customerDate, customerError, customerInitials } from './customer-api.service';
import { CustomerStatusComponent } from './customer-status.component';

@Component({
    selector: 'app-customers',
    imports: [ReactiveFormsModule, RouterLink, ButtonModule, InputTextModule, MessageModule, SelectModule, SkeletonModule, TableModule, CustomerStatusComponent],
    templateUrl: './customers.component.html', styleUrl: './customers.scss'
})
export class CustomersComponent {
    readonly locale = inject(LocaleService);
    private readonly api = inject(CustomerApi);
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly reload = signal(0);
    readonly loading = signal(true);
    readonly error = signal('');
    readonly rows = signal<Customer[]>([]);
    readonly meta = signal<PaginationMeta | null>(null);
    readonly filters = signal<CustomerFilters>({ name: '', mobile: '', status: '', page: 1 });
    readonly form = new FormGroup({
        name: new FormControl('', { nonNullable: true, validators: Validators.maxLength(100) }),
        mobile: new FormControl('', { nonNullable: true, validators: Validators.maxLength(20) }),
        status: new FormControl<CustomerStatus | ''>('', { nonNullable: true })
    });
    readonly statuses = computed(() => [
        { label: this.locale.t('allStatuses'), value: '' },
        { label: this.locale.t('unblocked'), value: 'unblocked' },
        { label: this.locale.t('blockedStatus'), value: 'blocked' }
    ]);
    readonly filtered = computed(() => !!(this.filters().name || this.filters().mobile || this.filters().status));
    readonly query = computed(() => {
        const f = this.filters();
        return { name: f.name || null, mobile: f.mobile || null, status: f.status || null, page: f.page > 1 ? f.page : null };
    });
    readonly rangeStart = computed(() => {
        const m = this.meta();
        return m && this.rows().length ? (m.current_page - 1) * m.per_page + 1 : 0;
    });
    readonly rangeEnd = computed(() => this.rows().length ? this.rangeStart() + this.rows().length - 1 : 0);
    readonly initials = customerInitials;
    date(value: string): string { return customerDate(value, this.locale.language()); }
    number(value: number): string { return new Intl.NumberFormat(this.locale.language()).format(value); }

    constructor() {
        combineLatest([this.route.queryParamMap, toObservable(this.locale.language), toObservable(this.reload)]).pipe(
            switchMap(([params]) => {
                const page = Number(params.get('page') ?? 1);
                const status = params.get('status');
                const filters: CustomerFilters = {
                    name: (params.get('name') ?? '').slice(0, 100),
                    mobile: (params.get('mobile') ?? '').slice(0, 20),
                    status: status === 'blocked' || status === 'unblocked' ? status : '',
                    page: Number.isSafeInteger(page) && page > 0 ? page : 1
                };
                this.filters.set(filters);
                this.form.reset({ name: filters.name, mobile: filters.mobile, status: filters.status });
                this.loading.set(true); this.error.set(''); this.rows.set([]); this.meta.set(null);
                return this.api.list(filters).pipe(
                    map(result => ({ result, error: '' })),
                    catchError(error => of({ result: null, error: customerError(error, this.locale) }))
                );
            }), takeUntilDestroyed()
        ).subscribe(({ result, error }) => {
            // A filtered page can disappear after a status change or another administrator's edit.
            if (result && result.meta.current_page > result.meta.last_page) {
                this.navigate({ ...this.filters(), page: Math.max(1, result.meta.last_page) }, true);
                return;
            }
            this.rows.set(result?.customers ?? []); this.meta.set(result?.meta ?? null);
            this.error.set(error); this.loading.set(false);
        });
    }
    apply(): void {
        if (this.form.invalid) return;
        const value = this.form.getRawValue();
        this.navigate({ name: value.name.trim(), mobile: value.mobile.trim(), status: value.status, page: 1 });
    }
    clear(): void { this.navigate({ name: '', mobile: '', status: '', page: 1 }); }
    changePage(page: number): void {
        if (this.loading() || page < 1 || page > (this.meta()?.last_page ?? 1)) return;
        this.navigate({ ...this.filters(), page });
    }
    refresh(): void { this.reload.update(value => value + 1); }
    private navigate(filters: CustomerFilters, replaceUrl = false): void {
        if (JSON.stringify(filters) === JSON.stringify(this.filters())) { this.refresh(); return; }
        void this.router.navigate([], { relativeTo: this.route, replaceUrl, queryParams: {
            name: filters.name || null, mobile: filters.mobile || null, status: filters.status || null,
            page: filters.page > 1 ? filters.page : null
        } });
    }
}

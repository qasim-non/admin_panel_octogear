import { HttpErrorResponse } from '@angular/common/http';
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
import { TagModule } from 'primeng/tag';
import { errorMessage, PaginationMeta } from '../../core/api-client';
import { LocaleService } from '../../core/locale.service';
import { CitySelectComponent } from '../../shared/city-select.component';
import { sarAmount } from '../../shared/money';
import { userDate } from '../users/user-api.service';
import { AdminPayment, PaymentApi, PaymentFilters, PaymentStatus, PaymentMethod, paymentStatuses, paymentStatusKeys, paymentMethods, paymentMethodKeys } from './payment-api.service';

@Component({ selector: 'app-payment-directory',
    imports: [ReactiveFormsModule, RouterLink, ButtonModule, InputTextModule, MessageModule, SelectModule, SkeletonModule, TableModule, TagModule, CitySelectComponent],
    templateUrl: './payment-directory.component.html', styleUrls: ['../users/users.scss', './payments.scss'] })
export class PaymentDirectoryComponent {
    readonly locale = inject(LocaleService);
    private readonly route = inject(ActivatedRoute); private readonly router = inject(Router); private readonly api = inject(PaymentApi);
    private readonly reload = signal(0);
    readonly rows = signal<AdminPayment[]>([]); readonly meta = signal<PaginationMeta | null>(null);
    readonly loading = signal(true); readonly error = signal(''); readonly dateError = signal(false);
    readonly filters = signal<PaymentFilters>(this.emptyFilters());
    readonly form = new FormGroup({
        search: new FormControl('', { nonNullable: true, validators: Validators.maxLength(100) }),
        order_id: new FormControl<number | null>(null, [Validators.min(1), Validators.pattern(/^\d+$/)]),
        city_id: new FormControl<number | null>(null),
        status: new FormControl('', { nonNullable: true }), method: new FormControl('', { nonNullable: true }), type: new FormControl('', { nonNullable: true }),
        date_from: new FormControl('', { nonNullable: true }), date_to: new FormControl('', { nonNullable: true })
    });
    readonly statuses = computed(() => [{ label: this.locale.t('allStatuses'), value: '' }, ...paymentStatuses.map(value => ({ label: this.locale.t(paymentStatusKeys[value]), value }))]);
    readonly methods = computed(() => [{ label: this.locale.t('allPaymentMethods'), value: '' }, ...paymentMethods.map(value => ({ label: this.locale.t(paymentMethodKeys[value]), value }))]);
    readonly types = computed(() => [{ label: this.locale.t('allOrderTypes'), value: '' }, { label: this.locale.t('generalOrder'), value: 'general' }, { label: this.locale.t('specificOrder'), value: 'specific' }]);
    readonly knownCity = computed(() => this.rows().find(row => row.order?.customer?.city?.id === this.filters().city_id)?.order?.customer?.city ?? null);
    readonly query = computed(() => ({ ...this.queryFor(this.filters()), source: 'payments' }));
    readonly rangeStart = computed(() => this.rows().length ? ((this.meta()?.current_page ?? 1) - 1) * (this.meta()?.per_page ?? 25) + 1 : 0);
    readonly rangeEnd = computed(() => this.rows().length ? this.rangeStart() + this.rows().length - 1 : 0);
    statusLabel(status: PaymentStatus): string { return this.locale.t(paymentStatusKeys[status]); }
    methodLabel(method: PaymentMethod): string { return this.locale.t(paymentMethodKeys[method]); }
    number(value: number): string { return new Intl.NumberFormat(this.locale.language()).format(value); }
    date(value: string): string { return userDate(value, this.locale.language(), true); }
    money(value: number): string { return sarAmount(value, this.locale.language()); }
    severity(status: PaymentStatus): 'warn' | 'success' | 'danger' | 'secondary' { return ({ pending: 'warn', paid: 'success', failed: 'danger', refunded: 'secondary' } as const)[status]; }
    constructor() {
        combineLatest([this.route.queryParamMap, toObservable(this.locale.language), toObservable(this.reload)]).pipe(switchMap(([params]) => {
            const f: PaymentFilters = { search: (params.get('search') ?? '').slice(0, 100), order_id: this.id(params.get('order_id')), city_id: this.id(params.get('city_id')),
                status: paymentStatuses.some(s => s === params.get('status')) ? params.get('status')! : '', method: paymentMethods.some(s => s === params.get('method')) ? params.get('method')! : '',
                type: ['general', 'specific'].includes(params.get('type') ?? '') ? params.get('type')! : '', date_from: params.get('date_from') ?? '', date_to: params.get('date_to') ?? '', page: this.id(params.get('page')) ?? 1 };
            this.filters.set(f); this.form.reset(f); this.rows.set([]); this.meta.set(null); this.loading.set(true); this.error.set(''); this.dateError.set(false);
            return this.api.list(f).pipe(map(result => ({ result, error: '' })), catchError(error => of({ result: null, error: error instanceof HttpErrorResponse && error.status === 403 ? this.locale.t('paymentsDenied') : error instanceof HttpErrorResponse && error.status === 422 ? this.locale.t('paymentFiltersInvalid') : errorMessage(error, this.locale) })));
        }), takeUntilDestroyed()).subscribe(({ result, error }) => {
            if (result && result.meta.current_page > result.meta.last_page) { this.navigate({ ...this.filters(), page: result.meta.last_page }, true); return; }
            this.rows.set(result?.payments ?? []); this.meta.set(result?.meta ?? null); this.error.set(error); this.loading.set(false);
        });
    }
    apply(): void {
        if (this.form.invalid) return;
        const f = this.form.getRawValue(); this.dateError.set(Boolean(f.date_from && f.date_to && f.date_from > f.date_to));
        if (!this.dateError()) this.navigate({ ...f, search: f.search.trim(), page: 1 });
    }
    clear(): void { this.navigate(this.emptyFilters()); }
    refresh(): void { this.reload.update(n => n + 1); }
    changePage(page: number): void { if (!this.loading() && page > 0 && page <= (this.meta()?.last_page ?? 1)) this.navigate({ ...this.filters(), page }); }
    private emptyFilters(): PaymentFilters { return { search: '', order_id: null, city_id: null, status: '', method: '', type: '', date_from: '', date_to: '', page: 1 }; }
    private id(value: string | null): number | null { const id = Number(value); return Number.isSafeInteger(id) && id > 0 ? id : null; }
    private queryFor(f: PaymentFilters) { return Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v === '' || (k === 'page' && v === 1) ? null : v])); }
    private navigate(filters: PaymentFilters, replaceUrl = false): void {
        const next = this.router.createUrlTree([], { relativeTo: this.route, queryParams: this.queryFor(filters) });
        if (this.router.serializeUrl(next) === this.router.url) this.refresh(); else void this.router.navigateByUrl(next, { replaceUrl });
    }
}

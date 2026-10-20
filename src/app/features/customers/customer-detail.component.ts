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
import { Customer, CustomerApi, CustomerStatus, customerDate, customerError, customerInitials } from './customer-api.service';
import { CustomerStatusComponent } from './customer-status.component';

@Component({
    selector: 'app-customer-detail',
    imports: [RouterLink, ButtonModule, DialogModule, MessageModule, SkeletonModule, CustomerStatusComponent],
    templateUrl: './customer-detail.component.html', styleUrl: './customers.scss'
})
export class CustomerDetailComponent {
    readonly locale = inject(LocaleService);
    private readonly api = inject(CustomerApi);
    private readonly destroyRef = inject(DestroyRef);
    readonly route = inject(ActivatedRoute);
    private readonly reload = signal(0);
    readonly data = signal<Customer | null>(null);
    readonly loading = signal(true);
    readonly error = signal('');
    readonly unavailable = signal(false);
    readonly saving = signal(false);
    readonly confirmVisible = signal(false);
    readonly mutationError = signal('');
    readonly needsRefresh = signal(false);
    readonly updated = signal(false);
    readonly initials = customerInitials;
    date(value: string): string { return customerDate(value, this.locale.language(), true); }
    number(value: number): string { return new Intl.NumberFormat(this.locale.language()).format(value); }

    constructor() {
        combineLatest([this.route.paramMap, toObservable(this.locale.language), toObservable(this.reload)]).pipe(
            // Locale switches during a write are reconciled by the read after its response.
            filter(() => !this.saving()),
            switchMap(([params]) => {
                const id = Number(params.get('id'));
                this.loading.set(true); this.error.set(''); this.unavailable.set(false);
                this.data.set(null); this.confirmVisible.set(false);
                if (!Number.isSafeInteger(id) || id <= 0) return of({ data: null, unavailable: true, error: '' });
                return this.api.get(id).pipe(
                    map(customer => ({ data: customer.type === 'customer' ? customer : null, unavailable: customer.type !== 'customer', error: '' })),
                    catchError(error => of({ data: null, unavailable: error instanceof HttpErrorResponse && error.status === 404, error: customerError(error, this.locale) }))
                );
            }), takeUntilDestroyed()
        ).subscribe(result => {
            this.data.set(result.data); this.unavailable.set(result.unavailable); this.error.set(result.error); this.loading.set(false);
            if (result.data) { this.needsRefresh.set(false); this.mutationError.set(''); }
        });
    }
    refresh(): void {
        if (this.saving()) return;
        this.confirmVisible.set(false); this.reload.update(value => value + 1);
    }
    requestStatusChange(): void {
        if (!this.data() || this.saving() || this.needsRefresh()) return;
        this.updated.set(false); this.mutationError.set(''); this.confirmVisible.set(true);
    }
    changeStatus(): void {
        const customer = this.data();
        if (!customer || this.saving() || this.needsRefresh() || !this.confirmVisible()) return;
        const status: CustomerStatus = customer.status === 'blocked' ? 'unblocked' : 'blocked';
        this.saving.set(true);
        this.api.setStatus(customer.id, status).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: () => {
                this.saving.set(false); this.confirmVisible.set(false); this.updated.set(true);
                this.refresh();
            },
            error: error => {
                this.saving.set(false); this.needsRefresh.set(true);
                this.mutationError.set(error instanceof HttpErrorResponse && error.status === 403
                    ? this.locale.t('customerAccessDenied') : this.locale.t('statusUncertain'));
            }
        });
    }
}

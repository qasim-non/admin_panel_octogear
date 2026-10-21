import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, combineLatest, map, of, switchMap } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { LocaleService, TextKey } from '../../core/locale.service';
import { PrivateImageComponent } from '../../shared/private-image.component';
import { sarAmount } from '../../shared/money';
import { userDate } from '../users/user-api.service';
import { AdminOrder, OrderApi, orderError, orderImagePath, orderPart } from './order-api.service';
import { OrderStatusComponent } from './order-status.component';

@Component({ selector: 'app-order-detail', imports: [RouterLink, ButtonModule, MessageModule, SkeletonModule, TagModule, PrivateImageComponent, OrderStatusComponent],
    templateUrl: './order-detail.component.html', styleUrls: ['../users/users.scss', './orders.scss'] })
export class OrderDetailComponent {
    readonly locale = inject(LocaleService); private readonly route = inject(ActivatedRoute); private readonly api = inject(OrderApi);
    private readonly reload = signal(0); readonly data = signal<AdminOrder | null>(null); readonly loading = signal(true); readonly error = signal(''); readonly unavailable = signal(false);
    readonly part = orderPart; readonly imagePath = orderImagePath;
    date(value: string): string { return userDate(value, this.locale.language(), true); }
    money(value: number | null | undefined): string { return typeof value === 'number' ? sarAmount(value, this.locale.language()) : this.locale.t('notProvided'); }
    fromPayments(): boolean { return this.route.snapshot.queryParamMap.get('source') === 'payments'; }
    backQuery() { const { source, ...filters } = this.route.snapshot.queryParams; return filters; }
    label(value: string | null | undefined): string {
        const keys: Record<string, TextKey> = { pending: 'pending', accepted: 'offerAccepted', rejected: 'offerRejected', not_selected: 'offerNotSelected', paid: 'paid', failed: 'failedPayment', refunded: 'refundedPayment', cash: 'cashPayment', credit_card: 'cardPayment', automatic: 'automaticTransmission', manual: 'manualTransmission', unknown: 'unknownTransmission' };
        return value && keys[value] ? this.locale.t(keys[value]) : this.locale.t('notProvided');
    }
    constructor() {
        combineLatest([this.route.paramMap, toObservable(this.locale.language), toObservable(this.reload)]).pipe(switchMap(([params]) => {
            const id = Number(params.get('id')); this.loading.set(true); this.error.set(''); this.unavailable.set(false); this.data.set(null);
            if (!Number.isSafeInteger(id) || id <= 0) return of({ data: null, unavailable: true, error: '' });
            return this.api.get(id).pipe(map(data => ({ data, unavailable: false, error: '' })), catchError(error => of({ data: null, unavailable: error instanceof HttpErrorResponse && error.status === 404, error: orderError(error, this.locale) })));
        }), takeUntilDestroyed()).subscribe(result => { this.data.set(result.data); this.unavailable.set(result.unavailable); this.error.set(result.error); this.loading.set(false); });
    }
    refresh(): void { this.reload.update(value => value + 1); }
}

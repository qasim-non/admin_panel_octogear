import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, map, of, switchMap } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ApiClient, errorMessage } from '../../core/api-client';
import { LocaleService } from '../../core/locale.service';

interface Overview {
    users: { total: number; customers: number; providers: number; blocked: number };
    stores: { total: number; active: number; inactive: number; pending_requests: number };
    orders: { total: number; pending: number; awaiting_payment: number; paid: number; completed: number; cancelled: number };
}

@Component({
    selector: 'app-overview', imports: [RouterLink, DecimalPipe, ButtonModule, MessageModule, SkeletonModule, TableModule, TagModule],
    template: `
      <header class="page-heading"><div><p class="eyebrow">{{ locale.t('workspace') }}</p><h1>{{ locale.t('overview') }}</h1><p>{{ locale.t('overviewIntro') }}</p></div>
        <button pButton severity="secondary" [outlined]="true" icon="pi pi-refresh" [label]="locale.t('refresh')" [disabled]="loading()" (click)="refresh()"></button>
      </header>
      @if (error()) {
        <div class="surface-panel error-panel"><p-message severity="error">{{ error() }}</p-message><button pButton (click)="refresh()">{{ locale.t('retry') }}</button></div>
      } @else if (loading()) {
        <div class="metric-grid" aria-busy="true">@for (item of [1,2,3,4]; track item) { <div class="surface-panel metric"><p-skeleton width="7rem"/><p-skeleton height="2.5rem" width="5rem" [style]="{marginTop: '1rem'}"/></div> }</div>
        <div class="surface-panel"><p-skeleton height="17rem"/></div>
      } @else if (data(); as summary) {
        <div class="metric-grid">
          @for (item of metrics(); track item.label) {
            <article class="surface-panel metric"><span class="metric-label">{{ item.label }}</span><div class="metric-value">{{ item.value | number }}<i [class]="item.icon" aria-hidden="true"></i></div></article>
          }
        </div>
        <div class="overview-grid">
          <section class="surface-panel table-panel" aria-labelledby="order-summary-heading">
            <div class="section-heading"><div><h2 id="order-summary-heading">{{ locale.t('orderSummary') }}</h2><p>{{ locale.t('orderSummaryIntro') }}</p></div><span class="total-pill">{{ summary.orders.total | number }} {{ locale.t('total') }}</span></div>
            @if (summary.orders.total === 0) {
              <div class="empty-state"><i class="pi pi-inbox" aria-hidden="true"></i><h3>{{ locale.t('noOrders') }}</h3><p>{{ locale.t('noOrdersBody') }}</p></div>
            } @else {
              <p-table [value]="rows()" [tableStyle]="{'min-width':'20rem'}">
                <ng-template #header><tr><th scope="col">{{ locale.t('status') }}</th><th scope="col" class="numeric">{{ locale.t('orders') }}</th></tr></ng-template>
                <ng-template #body let-row><tr><td><p-tag [value]="row.label" [severity]="row.severity"/></td><td class="numeric">{{ row.count | number }}</td></tr></ng-template>
              </p-table>
            }
          </section>
          <section class="surface-panel review-panel"><span class="review-icon"><i class="pi pi-clipboard" aria-hidden="true"></i></span><p class="eyebrow">{{ locale.t('reviewQueue') }}</p><h2>{{ locale.t('pendingStores') }}</h2><strong class="review-count">{{ summary.stores.pending_requests | number }}</strong><p>{{ locale.t('pendingIntro') }}</p><a pButton routerLink="/store-requests" [queryParams]="{status:'pending'}">{{ locale.t('openReviewQueue') }}</a></section>
        </div>
      }
    `
})
export class OverviewComponent {
    readonly locale = inject(LocaleService);
    private readonly api = inject(ApiClient);
    readonly data = signal<Overview | null>(null);
    readonly loading = signal(true);
    readonly error = signal('');
    private readonly reload = signal(0);
    readonly metrics = computed(() => {
        const data = this.data();
        return data ? [
            { label: this.locale.t('customers'), value: data.users.customers, icon: 'pi pi-users' },
            { label: this.locale.t('providers'), value: data.users.providers, icon: 'pi pi-id-card' },
            { label: this.locale.t('stores'), value: data.stores.total, icon: 'pi pi-shop' },
            { label: this.locale.t('orders'), value: data.orders.total, icon: 'pi pi-box' }
        ] : [];
    });
    readonly rows = computed(() => {
        const data = this.data();
        return data ? [
            { label: this.locale.t('pending'), count: data.orders.pending, severity: 'warn' },
            { label: this.locale.t('awaitingPayment'), count: data.orders.awaiting_payment, severity: 'secondary' },
            { label: this.locale.t('paid'), count: data.orders.paid, severity: 'info' },
            { label: this.locale.t('completed'), count: data.orders.completed, severity: 'success' },
            { label: this.locale.t('cancelled'), count: data.orders.cancelled, severity: 'secondary' }
        ] : [];
    });
    constructor() {
        toObservable(this.reload).pipe(switchMap(() => {
            this.loading.set(true); this.error.set('');
            return this.api.get<Overview>('admin/dashboard').pipe(map(response => ({ data: response.data, error: '' })), catchError(error => of({ data: null, error: errorMessage(error, this.locale) })));
        }), takeUntilDestroyed()).subscribe(result => { this.data.set(result.data); this.error.set(result.error); this.loading.set(false); });
    }
    refresh(): void { this.reload.update(value => value + 1); }
}

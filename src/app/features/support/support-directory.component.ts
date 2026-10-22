import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { auditTime, catchError, combineLatest, map, of, switchMap } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { errorMessage, PaginationMeta } from '../../core/api-client';
import { LocaleService } from '../../core/locale.service';
import { userDate } from '../users/user-api.service';
import { emptySupportFilters, SupportApi, SupportConversation, SupportFilters, supportFilters, supportQuery } from './support-api.service';
import { SupportRealtime } from './support-realtime.service';

@Component({ selector: 'app-support-directory', imports: [ReactiveFormsModule, RouterLink, ButtonModule, InputTextModule, SelectModule, TableModule, TagModule],
    templateUrl: './support-directory.component.html', styleUrls: ['../users/users.scss', './support.scss'] })
export class SupportDirectoryComponent {
    readonly locale = inject(LocaleService);
    private readonly api = inject(SupportApi); private readonly route = inject(ActivatedRoute); private readonly router = inject(Router);
    private readonly realtime = inject(SupportRealtime); private readonly reload = signal(0);
    private requesting = false; private realtimePending = false;
    readonly rows = signal<SupportConversation[]>([]); readonly meta = signal<PaginationMeta | null>(null);
    readonly loading = signal(true); readonly error = signal(''); readonly filters = signal(emptySupportFilters());
    readonly query = computed(() => supportQuery(this.filters()));
    readonly form = new FormGroup({ search: new FormControl('', { nonNullable: true, validators: Validators.maxLength(100) }),
        status: new FormControl<SupportFilters['status']>('open', { nonNullable: true }), type: new FormControl('', { nonNullable: true }), unread: new FormControl('', { nonNullable: true }) });
    readonly statuses = computed(() => ['open', 'closed', 'all'].map(value => ({ value, label: this.locale.t(value === 'open' ? 'supportOpen' : value === 'closed' ? 'supportClosed' : 'supportAll') })));
    readonly types = computed(() => [{ value: '', label: this.locale.t('supportAllAccounts') }, { value: 'customer', label: this.locale.t('customers') }, { value: 'service provider', label: this.locale.t('providers') }]);
    readonly unreadOptions = computed(() => [{ value: '', label: this.locale.t('supportAnyRead') }, { value: 'true', label: this.locale.t('supportUnreadOnly') }]);
    constructor() {
        // Event-driven refresh keeps ordering, pagination and filtered totals owned by the API.
        this.realtime.events.pipe(auditTime(400), takeUntilDestroyed()).subscribe(() => {
            if (this.requesting) this.realtimePending = true; else this.refresh();
        });
        combineLatest([this.route.queryParamMap, toObservable(this.reload), toObservable(this.locale.language)]).pipe(switchMap(([params]) => {
            const f = supportFilters(key => params.get(key));
            const changed = JSON.stringify(f) !== JSON.stringify(this.filters());
            if (changed) { this.filters.set(f); this.form.reset(f); this.rows.set([]); this.meta.set(null); }
            this.loading.set(!this.meta()); this.error.set(''); this.requesting = true;
            return this.api.list(f).pipe(map(result => ({ result, error: '' })), catchError(error => of({ result: null, error: errorMessage(error, this.locale) })));
        }), takeUntilDestroyed()).subscribe(({ result, error }) => {
            this.requesting = false;
            if (result && result.meta.current_page > result.meta.last_page) { this.navigate({ ...this.filters(), page: result.meta.last_page }, true); return; }
            this.rows.set(result?.rows ?? []); this.meta.set(result?.meta ?? null); this.error.set(error); this.loading.set(false);
            if (this.realtimePending) { this.realtimePending = false; this.refresh(); }
        });
    }
    date(value: string | null): string { return value ? userDate(value, this.locale.language(), true) : '—'; }
    number(value: number): string { return new Intl.NumberFormat(this.locale.language()).format(value); }
    apply(): void { if (this.form.valid) { const f = this.form.getRawValue(); this.navigate({ ...f, search: f.search.trim(), page: 1 }); } }
    clear(): void { const filters = emptySupportFilters(); this.form.reset(filters); this.navigate(filters); }
    refresh(): void { this.reload.update(n => n + 1); }
    changePage(page: number): void { if (!this.loading() && page > 0 && page <= (this.meta()?.last_page ?? 1)) this.navigate({ ...this.filters(), page }); }
    private navigate(filters: SupportFilters, replaceUrl = false): void {
        const next = this.router.createUrlTree([], { relativeTo: this.route, queryParams: supportQuery(filters) });
        if (this.router.serializeUrl(next) === this.router.url) this.refresh(); else void this.router.navigateByUrl(next, { replaceUrl });
    }
}

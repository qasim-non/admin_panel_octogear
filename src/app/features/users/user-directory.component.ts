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
import { USER_DIRECTORIES, UserKind } from './user-directory.config';
import { LocaleService } from '../../core/locale.service';
import { CitySelectComponent } from '../../shared/city-select.component';
import { AdminUser, UserApi, UserFilters, UserStatus, userDate, userError, userInitials } from './user-api.service';
import { UserStatusComponent } from './user-status.component';

@Component({
    selector: 'app-user-directory',
    imports: [ReactiveFormsModule, RouterLink, ButtonModule, InputTextModule, MessageModule, SelectModule, SkeletonModule, TableModule, UserStatusComponent, CitySelectComponent],
    templateUrl: './user-directory.component.html', styleUrl: './users.scss'
})
export class UserDirectoryComponent {
    readonly locale = inject(LocaleService);
    private readonly api = inject(UserApi);
    private readonly route = inject(ActivatedRoute);
    readonly config = USER_DIRECTORIES[this.route.snapshot.data['userKind'] as UserKind];
    readonly copy = this.config.copy;
    private readonly router = inject(Router);
    private readonly reload = signal(0);
    readonly loading = signal(true);
    readonly error = signal('');
    readonly rows = signal<AdminUser[]>([]);
    readonly meta = signal<PaginationMeta | null>(null);
    readonly filters = signal<UserFilters>({ name: '', mobile: '', status: '', city_id: null, page: 1 });
    readonly form = new FormGroup({
        name: new FormControl('', { nonNullable: true, validators: Validators.maxLength(100) }),
        mobile: new FormControl('', { nonNullable: true, validators: Validators.maxLength(20) }),
        status: new FormControl<UserStatus | ''>('', { nonNullable: true }),
        city_id: new FormControl<number | null>(null)
    });
    readonly statuses = computed(() => [
        { label: this.locale.t('allStatuses'), value: '' },
        { label: this.locale.t('unblocked'), value: 'unblocked' },
        { label: this.locale.t('blockedStatus'), value: 'blocked' }
    ]);
    readonly filtered = computed(() => !!(this.filters().name || this.filters().mobile || this.filters().status || this.filters().city_id));
    readonly knownCity = computed(() => this.rows().find(row => row.city?.id === this.filters().city_id)?.city ?? null);
    readonly query = computed(() => {
        const f = this.filters();
        return { name: f.name || null, mobile: f.mobile || null, status: f.status || null, city_id: f.city_id, page: f.page > 1 ? f.page : null };
    });
    readonly rangeStart = computed(() => {
        const m = this.meta();
        return m && this.rows().length ? (m.current_page - 1) * m.per_page + 1 : 0;
    });
    readonly rangeEnd = computed(() => this.rows().length ? this.rangeStart() + this.rows().length - 1 : 0);
    readonly initials = userInitials;
    date(value: string): string { return userDate(value, this.locale.language()); }
    number(value: number): string { return new Intl.NumberFormat(this.locale.language()).format(value); }

    constructor() {
        combineLatest([this.route.queryParamMap, toObservable(this.locale.language), toObservable(this.reload)]).pipe(
            switchMap(([params]) => {
                const page = Number(params.get('page') ?? 1);
                const status = params.get('status');
                const cityId = Number(params.get('city_id'));
                const filters: UserFilters = {
                    name: (params.get('name') ?? '').slice(0, 100),
                    mobile: (params.get('mobile') ?? '').slice(0, 20),
                    status: status === 'blocked' || status === 'unblocked' ? status : '',
                    city_id: Number.isSafeInteger(cityId) && cityId > 0 ? cityId : null,
                    page: Number.isSafeInteger(page) && page > 0 ? page : 1
                };
                this.filters.set(filters);
                this.form.reset({ name: filters.name, mobile: filters.mobile, status: filters.status, city_id: filters.city_id });
                this.loading.set(true); this.error.set(''); this.rows.set([]); this.meta.set(null);
                return this.api.list(this.config.kind, filters).pipe(
                    map(result => ({ result, error: '' })),
                    catchError(error => of({ result: null, error: userError(error, this.locale, this.copy.denied) }))
                );
            }), takeUntilDestroyed()
        ).subscribe(({ result, error }) => {
            // A filtered page can disappear after a status change or another administrator's edit.
            if (result && result.meta.current_page > result.meta.last_page) {
                this.navigate({ ...this.filters(), page: Math.max(1, result.meta.last_page) }, true);
                return;
            }
            this.rows.set(result?.users ?? []); this.meta.set(result?.meta ?? null);
            this.error.set(error); this.loading.set(false);
        });
    }
    apply(): void {
        if (this.form.invalid) return;
        const value = this.form.getRawValue();
        this.navigate({ name: value.name.trim(), mobile: value.mobile.trim(), status: value.status, city_id: value.city_id, page: 1 });
    }
    clear(): void { this.navigate({ name: '', mobile: '', status: '', city_id: null, page: 1 }); }
    changePage(page: number): void {
        if (this.loading() || page < 1 || page > (this.meta()?.last_page ?? 1)) return;
        this.navigate({ ...this.filters(), page });
    }
    refresh(): void { this.reload.update(value => value + 1); }
    private navigate(filters: UserFilters, replaceUrl = false): void {
        if (JSON.stringify(filters) === JSON.stringify(this.filters())) { this.refresh(); return; }
        void this.router.navigate([], { relativeTo: this.route, replaceUrl, queryParams: {
            name: filters.name || null, mobile: filters.mobile || null, status: filters.status || null,
            city_id: filters.city_id,
            page: filters.page > 1 ? filters.page : null
        } });
    }
}

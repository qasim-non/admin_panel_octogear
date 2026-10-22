import { SessionService } from '../../core/session.service';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, combineLatest, map, of, switchMap } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { errorMessage, PaginationMeta } from '../../core/api-client';
import { LocaleService } from '../../core/locale.service';
import { CompanySelectComponent } from './company-select.component';
import { CatalogEditorComponent } from './catalog-editor.component';
import { CatalogFilters, CatalogKind, CatalogRow, VehicleCatalogApi } from './vehicle-catalog-api.service';

@Component({ selector: 'app-vehicle-catalog',
    imports: [ReactiveFormsModule, RouterLink, ButtonModule, InputTextModule, MessageModule, SkeletonModule, TableModule, CompanySelectComponent, CatalogEditorComponent],
    templateUrl: './vehicle-catalog.component.html', styleUrls: ['../users/users.scss', './vehicle-catalog.scss'] })
export class VehicleCatalogComponent {
    readonly session = inject(SessionService);
    readonly locale = inject(LocaleService);
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly api = inject(VehicleCatalogApi);
    readonly kind: CatalogKind = this.route.snapshot.data['catalogKind'];
    readonly isCompanies = this.kind === 'companies';
    readonly title = this.isCompanies ? 'carCompanies' : 'carModels';
    readonly directoryTitle = this.isCompanies ? 'companyDirectory' : 'modelDirectory';
    readonly rows = signal<CatalogRow[]>([]);
    readonly meta = signal<PaginationMeta | null>(null);
    readonly loading = signal(true);
    readonly error = signal('');
    readonly editor = signal<{ row: CatalogRow | null; deleting: boolean } | null>(null);
    readonly notice = signal('');
    openEditor(row: CatalogRow | null = null, deleting = false): void { this.notice.set(''); this.editor.set({ row, deleting }); }
    closeEditor(refresh: boolean): void { this.editor.set(null); if (refresh) this.refresh(); }
    saved(): void { this.notice.set(this.locale.t(this.editor()?.deleting ? 'catalogDeleted' : 'catalogSaved')); this.editor.set(null); this.refresh(); }
    readonly filters = signal<CatalogFilters>({ search: '', company_id: null, page: 1 });
    private readonly reload = signal(0);
    readonly returnQuery = signal<Record<string, string | number | null>>({});
    readonly form = new FormGroup({
        search: new FormControl('', { nonNullable: true, validators: Validators.maxLength(100) }),
        company_id: new FormControl<number | null>(null)
    });
    readonly knownCompany = computed(() => this.rows().find(row => row.company?.id === this.filters().company_id)?.company ?? null);
    readonly rangeStart = computed(() => this.rows().length ? ((this.meta()?.current_page ?? 1) - 1) * (this.meta()?.per_page ?? 25) + 1 : 0);
    readonly rangeEnd = computed(() => this.rows().length ? this.rangeStart() + this.rows().length - 1 : 0);
    readonly hasFilters = computed(() => Boolean(this.filters().search || this.filters().company_id));

    constructor() {
        combineLatest([this.route.queryParamMap, toObservable(this.locale.language), toObservable(this.reload)]).pipe(
            switchMap(([params]) => {
                const filters = { search: (params.get('search') ?? '').slice(0, 100),
                    company_id: this.isCompanies ? null : this.id(params.get('company_id')), page: this.id(params.get('page')) ?? 1 };
                this.returnQuery.set({ search: (params.get('companies_search') ?? '').slice(0, 100) || null, page: this.id(params.get('companies_page')) });
                this.filters.set(filters); this.form.reset(filters); this.rows.set([]); this.meta.set(null); this.loading.set(true); this.error.set('');
                return this.api.list(this.kind, filters).pipe(map(result => ({ result, error: '' })), catchError(error => of({ result: null,
                    error: error instanceof HttpErrorResponse && error.status === 403 ? this.locale.t('catalogDenied') :
                        error instanceof HttpErrorResponse && error.status === 422 ? this.locale.t('catalogFiltersInvalid') : errorMessage(error, this.locale) })));
            }), takeUntilDestroyed()
        ).subscribe(({ result, error }) => {
            if (result && result.meta.current_page > result.meta.last_page) { this.navigate({ ...this.filters(), page: result.meta.last_page }, true); return; }
            this.rows.set(result?.rows ?? []); this.meta.set(result?.meta ?? null); this.error.set(error); this.loading.set(false);
        });
    }

    number(value: number): string { return new Intl.NumberFormat(this.locale.language()).format(value); }
    modelsQuery(id: number) { return { company_id: id, companies_search: this.filters().search || null, companies_page: this.filters().page > 1 ? this.filters().page : null }; }
    apply(): void { if (this.form.valid) { const f = this.form.getRawValue(); this.navigate({ ...f, search: f.search.trim(), page: 1 }); } }
    clear(): void { this.navigate({ search: '', company_id: null, page: 1 }); }
    refresh(): void { this.reload.update(n => n + 1); }
    changePage(page: number): void { if (!this.loading() && page > 0 && page <= (this.meta()?.last_page ?? 1)) this.navigate({ ...this.filters(), page }); }
    private id(value: string | null): number | null { const n = Number(value); return Number.isSafeInteger(n) && n > 0 ? n : null; }
    private navigate(filters: CatalogFilters, replaceUrl = false): void {
        const queryParams = { search: filters.search || null, company_id: filters.company_id, page: filters.page > 1 ? filters.page : null,
            ...(!this.isCompanies ? { companies_search: this.returnQuery()['search'], companies_page: this.returnQuery()['page'] } : {}) };
        const next = this.router.createUrlTree([], { relativeTo: this.route, queryParams });
        if (this.router.serializeUrl(next) === this.router.url) this.refresh(); else void this.router.navigateByUrl(next, { replaceUrl });
    }
}

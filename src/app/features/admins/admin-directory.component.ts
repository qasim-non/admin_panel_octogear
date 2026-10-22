import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, combineLatest, firstValueFrom, map, of, switchMap } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { LocaleService } from '../../core/locale.service';
import { SessionService } from '../../core/session.service';
import { PaginationMeta } from '../../core/api-client';
import { AdminAccount, AdminAccountApi, AdminRoleOption, accountError, confirmed } from './admin-account-api';
import { AdminEditorComponent, AdminEditorMode } from './admin-editor.component';
import { roleKey } from './admin-labels';

@Component({ selector: 'app-admin-directory', imports: [DatePipe, ReactiveFormsModule, ButtonModule, InputTextModule, MessageModule, SelectModule, TableModule, TagModule, AdminEditorComponent],
    templateUrl: './admin-directory.component.html', styleUrls: ['../users/users.scss', './admin-accounts.scss'] })
export class AdminDirectoryComponent {
    readonly locale = inject(LocaleService); readonly session = inject(SessionService);
    private readonly route = inject(ActivatedRoute); private readonly router = inject(Router); private readonly api = inject(AdminAccountApi);
    readonly rows = signal<AdminAccount[]>([]); readonly meta = signal<PaginationMeta | null>(null); readonly roles = signal<AdminRoleOption[]>([]);
    readonly loading = signal(true); readonly error = signal(''); readonly rolesError = signal(''); readonly notice = signal(''); readonly reload = signal(0);
    readonly editor = signal<{ row: AdminAccount | null; mode: AdminEditorMode } | null>(null);
    readonly form = inject(FormBuilder).nonNullable.group({ search: ['', Validators.maxLength(100)], role: [''], status: [''] });
    readonly roleOptions = computed(() => [{ value: '', label: this.locale.t('allAdminRoles') }, ...this.roles().map(role => ({ value: role.value, label: this.locale.t(roleKey(role.value)) }))]);
    readonly statusOptions = computed(() => [{value:'', label:this.locale.t('allStatuses')}, {value:'active',label:this.locale.t('adminActive')}, {value:'inactive',label:this.locale.t('adminInactive')}, {value:'blocked',label:this.locale.t('adminBlocked')}]);
    readonly roleKey = roleKey;
    readonly increment = (n: number) => n + 1;
    constructor() {
        void this.loadRoles();
        combineLatest([this.route.queryParamMap, toObservable(this.locale.language), toObservable(this.reload)]).pipe(switchMap(([params]) => {
            const filters = { search: (params.get('search') ?? '').slice(0,100), role: params.get('role') ?? '', status: params.get('status') ?? '' };
            this.form.reset(filters); this.loading.set(true); this.error.set(''); this.rows.set([]);
            return this.api.list({ ...filters, page: Math.max(1, Number(params.get('page')) || 1) }).pipe(map(response => ({ response, error: '' })), catchError(error => of({ response: null, error: accountError(error, this.locale) })));
        }), takeUntilDestroyed()).subscribe(({response,error}) => {
            this.loading.set(false); this.error.set(error);
            if (response?.success && response.meta) {
                if (response.meta.current_page > response.meta.last_page) { void this.navigate(response.meta.last_page); return; }
                this.rows.set(response.data); this.meta.set(response.meta);
            } else { this.meta.set(null); if (response) this.error.set(this.locale.t('unknownError')); }
        });
    }
    async loadRoles(): Promise<void> { this.rolesError.set(''); try { this.roles.set(confirmed(await firstValueFrom(this.api.roles()))); } catch (error) { this.rolesError.set(accountError(error, this.locale)); } }
    navigate(page = 1): Promise<boolean> { return this.router.navigate([], { relativeTo: this.route, queryParams: { ...this.form.getRawValue(), page } }); }
    clear(): void { this.form.reset(); void this.navigate(); }
    open(mode: AdminEditorMode, row: AdminAccount | null = null): void { this.notice.set(''); this.editor.set({ mode, row }); }
    close(refresh: boolean): void { this.editor.set(null); if (refresh) this.reload.update(n => n + 1); }
    status(row: AdminAccount): string { return this.locale.t(row.status === 'inactive' ? 'adminInactive' : row.status === 'blocked' ? 'adminBlocked' : row.must_change_password ? 'awaitingPassword' : 'adminActive'); }
}

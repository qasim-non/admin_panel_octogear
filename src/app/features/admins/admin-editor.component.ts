import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, input, OnDestroy, OnInit, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { LocaleService } from '../../core/locale.service';
import { PasswordFieldComponent } from '../../shared/password-field.component';
import { PaginationMeta } from '../../core/api-client';
import { AdminAccount, AdminAccountApi, AdminAuditEvent, AdminRoleOption, accountError, confirmed } from './admin-account-api';
import { roleKey, permissionKey } from './admin-labels';

export type AdminEditorMode = 'create' | 'edit' | 'reset' | 'archive' | 'detail';

@Component({ selector: 'app-admin-editor', imports: [DatePipe, ReactiveFormsModule, ButtonModule, DialogModule, InputTextModule, MessageModule, SelectModule, PasswordFieldComponent],
    templateUrl: './admin-editor.component.html', styleUrl: './admin-accounts.scss' })
export class AdminEditorComponent implements OnInit, OnDestroy {
    readonly locale = inject(LocaleService); private readonly api = inject(AdminAccountApi);
    readonly row = input<AdminAccount | null>(null); readonly mode = input.required<AdminEditorMode>(); readonly roles = input.required<AdminRoleOption[]>();
    readonly closed = output<boolean>(); readonly busy = signal(false); readonly error = signal(''); readonly uncertain = signal(false); readonly saved = signal(false);
    readonly events = signal<AdminAuditEvent[]>([]); readonly eventMeta = signal<PaginationMeta | null>(null); readonly eventLoading = signal(false); readonly eventError = signal('');
    private destroyed = false;
    readonly form = inject(FormBuilder).nonNullable.group({ name: ['', [Validators.required, Validators.maxLength(100)]], email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
        mobile: ['', [Validators.required, Validators.pattern(/^(?:\+?966|0)?5\d{8}$/)]], assigned_role: ['', Validators.required], preferred_language: ['en', Validators.required], status: ['active', Validators.required],
        password: ['', [Validators.required, Validators.minLength(15), Validators.maxLength(72)]], current_password: ['', Validators.required] });
    readonly roleOptions = computed(() => this.roles().map(role => ({ label: this.locale.t(roleKey(role.value)), value: role.value })));
    readonly statusOptions = computed(() => ['active', 'inactive', 'blocked'].map(value => ({ value, label: this.locale.t(value === 'active' ? 'adminActive' : value === 'inactive' ? 'adminInactive' : 'adminBlocked') })));
    readonly languageOptions = [{ value: 'en', label: 'English' }, { value: 'ar', label: 'العربية' }];
    readonly roleKey = roleKey; readonly permissionKey = permissionKey;
    get title() { return this.saved() ? 'adminSaved' : ({ create: 'addAdmin', edit: 'editAdmin', reset: 'resetAdminPassword', archive: 'archiveAdmin', detail: 'adminDetails' } as const)[this.mode()]; }
    get passwordMode() { return this.mode() === 'create' || this.mode() === 'reset'; }
    get editing() { return this.mode() === 'create' || this.mode() === 'edit'; }
    permissions(): string[] { return this.roles().find(role => role.value === this.form.controls.assigned_role.value)?.permissions ?? []; }
    ngOnInit(): void {
        const row = this.row();
        if (row) this.form.patchValue({ ...row, preferred_language: row.preferred_language ?? 'en' });
        if (!this.passwordMode) this.form.controls.password.clearValidators();
        if (!this.editing) for (const key of ['name', 'email', 'mobile', 'assigned_role', 'preferred_language', 'status'] as const) this.form.controls[key].clearValidators();
        for (const control of Object.values(this.form.controls)) control.updateValueAndValidity();
        this.form.updateValueAndValidity();
    }
    ngOnDestroy(): void { this.destroyed = true; this.form.reset(); }
    close(): void { if (!this.busy()) this.closed.emit(this.saved() || this.uncertain()); }
    async save(): Promise<void> {
        if (this.busy() || this.saved() || this.uncertain() || this.mode() === 'detail') return;
        this.form.markAllAsTouched(); this.error.set('');
        if (this.form.invalid) { this.error.set(this.locale.t('adminFormInvalid')); return; }
        const values = this.form.getRawValue();
        if (this.passwordMode && new TextEncoder().encode(values.password).length > 72) { this.error.set(this.locale.t('securePasswordHint')); return; }
        this.busy.set(true);
        const row = this.row();
        const action = { current_password: values.current_password, version: row?.version };
        try {
            if (this.mode() === 'archive' && row) confirmed(await firstValueFrom(this.api.archive(row, action)));
            else if (this.mode() === 'reset' && row) confirmed(await firstValueFrom(this.api.reset(row, { ...action, password: values.password })));
            else {
                const { password, ...fields } = values;
                confirmed(await firstValueFrom(this.api.save(row, { ...fields, ...(row ? { version: row.version } : { password }) })));
            }
            if (this.destroyed) return;
            this.saved.set(true); this.form.controls.current_password.reset();
            if (!this.passwordMode) this.closed.emit(true);
        } catch (error) {
            if (this.destroyed) return;
            this.error.set(accountError(error, this.locale));
            this.uncertain.set(!(error instanceof HttpErrorResponse) || ![400, 403, 422, 429].includes(error.status));
        } finally { if (!this.destroyed) this.busy.set(false); }
    }
    async loadEvents(page = 1): Promise<void> {
        const row = this.row(); if (!row || this.eventLoading()) return;
        this.eventLoading.set(true); this.eventError.set('');
        try { const response = await firstValueFrom(this.api.events(row, page)); if (!this.destroyed) { this.events.set(confirmed(response)); this.eventMeta.set(response.meta ?? null); } }
        catch (error) { if (!this.destroyed) this.eventError.set(accountError(error, this.locale)); }
        finally { if (!this.destroyed) this.eventLoading.set(false); }
    }
    eventLabel(action: string): string { return this.locale.t(({created:'auditCreated',updated:'auditUpdated',password_reset:'auditReset',password_setup:'auditSetup',password_changed:'auditPassword',archived:'auditArchived'} as const)[action as 'created'] ?? 'auditUpdated'); }
}

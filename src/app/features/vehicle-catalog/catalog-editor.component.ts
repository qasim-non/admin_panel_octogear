import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, input, OnInit, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, Observable } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { LocaleService } from '../../core/locale.service';
import { ApiEnvelope, errorMessage } from '../../core/api-client';
import { CompanySelectComponent } from './company-select.component';
import { CatalogKind, CatalogRow, VehicleCatalogApi } from './vehicle-catalog-api.service';

@Component({
    selector: 'app-catalog-editor',
    imports: [ReactiveFormsModule, ButtonModule, DialogModule, InputTextModule, MessageModule, CompanySelectComponent],
    template: `
        <p-dialog [visible]="true" (visibleChange)="close()" [modal]="true" [draggable]="false" [resizable]="false"
            [closable]="!saving()" [closeOnEscape]="!saving()" [dismissableMask]="false"
            [header]="locale.t(deleting() ? 'catalogDeleteTitle' : row() ? 'catalogEditTitle' : kind() === 'companies' ? 'addCompany' : 'addModel')"
            [style]="{width: '520px', maxWidth: 'calc(100vw - 24px)'}">
            @if (deleting()) {
                <div class="delete-summary"><i class="pi pi-trash" aria-hidden="true"></i><strong><bdi>{{ row()?.name }}</bdi></strong></div>
                <p class="editor-hint">{{ locale.t('catalogDeleteHint') }}</p>
            } @else {
                <p class="editor-hint">{{ locale.t('catalogNamesHint') }}</p>
                <form id="catalog-editor-form" [formGroup]="form" (ngSubmit)="submit()" class="editor-form">
                    <div class="editor-field"><label for="catalog-name-en">{{ locale.t('catalogNameEn') }}</label>
                        <input pInputText id="catalog-name-en" formControlName="name_en" dir="ltr" maxlength="100" autocomplete="off" [attr.aria-invalid]="invalid('name_en')" aria-describedby="catalog-name-en-error"/>
                        <small id="catalog-name-en-error" class="field-error">{{ fieldError('name_en') }}</small></div>
                    <div class="editor-field"><label for="catalog-name-ar">{{ locale.t('catalogNameAr') }}</label>
                        <input pInputText id="catalog-name-ar" formControlName="name_ar" dir="rtl" maxlength="100" autocomplete="off" [attr.aria-invalid]="invalid('name_ar')" aria-describedby="catalog-name-ar-error"/>
                        <small id="catalog-name-ar-error" class="field-error">{{ fieldError('name_ar') }}</small></div>
                    @if (kind() === 'companies') {
                        <div class="editor-field"><label for="catalog-country">{{ locale.t('countryOfOrigin') }} <span class="optional">{{ locale.t('catalogOptional') }}</span></label>
                            <app-company-select [disabled]="saving()" type="country" inputId="catalog-country" [value]="form.controls.parent_id.value" [knownCompany]="row()?.country ?? null" (valueChange)="form.controls.parent_id.setValue($event)"/>
                            <small class="field-error">{{ errors()['country_id'] }}</small></div>
                    } @else if (row()) {
                        <div class="editor-field"><span class="field-label">{{ locale.t('carCompany') }}</span><strong>{{ row()?.company?.name }}</strong><small>{{ locale.t('catalogCompanyFixed') }}</small></div>
                    } @else {
                        <div class="editor-field"><label for="catalog-parent">{{ locale.t('carCompany') }}</label>
                            <app-company-select [disabled]="saving()" inputId="catalog-parent" [required]="true" [value]="form.controls.parent_id.value" (valueChange)="form.controls.parent_id.setValue($event)"/>
                            <small class="field-error">{{ errors()['car_company_id'] || (submitted() && !form.controls.parent_id.value ? locale.t('chooseCompany') : '') }}</small></div>
                    }
                </form>
            }
            @if (error()) { <p-message severity="error">{{ error() }}</p-message> }
            <ng-template #footer>
                <button pButton type="button" severity="secondary" [outlined]="true" [label]="locale.t('cancel')" [disabled]="saving()" (click)="close()"></button>
                <button pButton type="button" [severity]="deleting() ? 'danger' : 'primary'" [label]="locale.t(deleting() ? 'catalogDelete' : 'catalogSave')"
                    [loading]="saving()" [disabled]="saving() || mustRefresh()" (click)="submit()"></button>
            </ng-template>
        </p-dialog>
    `,
    styles: `
        .editor-form { display: grid; gap: 18px; padding-bottom: 20px; }
        .editor-field { display: grid; gap: 7px; }
        label, .field-label { font-weight: 600; font-size: 13px; color: #242c41; }
        input { width: 100%; min-height: 46px; }
        .editor-hint { color: #65718a; font-size: 13px; line-height: 1.8; margin: 0 0 22px; }
        .optional, small { font-size: 12px; color: #65718a; font-weight: 400; }
        .field-error { color: #b42318; } .field-error:empty { display: none; }
        .delete-summary { display: flex; gap: 14px; align-items: center; margin: 8px 0 20px; overflow-wrap: anywhere; }
        .delete-summary i { color: #b42318; border-radius: 12px; background: #fff1ef; padding: 14px; }
    `
})
export class CatalogEditorComponent implements OnInit {
    readonly locale = inject(LocaleService);
    private readonly api = inject(VehicleCatalogApi);
    private readonly destroyRef = inject(DestroyRef);
    readonly kind = input.required<CatalogKind>();
    readonly row = input<CatalogRow | null>(null);
    readonly deleting = input(false);
    readonly companyId = input<number | null>(null);
    readonly closed = output<boolean>();
    readonly saved = output<void>();
    readonly saving = signal(false);
    readonly submitted = signal(false);
    readonly mustRefresh = signal(false);
    readonly error = signal('');
    readonly errors = signal<Record<string, string>>({});
    readonly form = new FormGroup({
        name_en: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(100)] }),
        name_ar: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(100)] }),
        parent_id: new FormControl<number | null>(null)
    });
    ngOnInit(): void {
        const row = this.row();
        this.form.reset({ name_en: row?.name_en ?? '', name_ar: row?.name_ar ?? '',
            parent_id: this.kind() === 'companies' ? row?.country_id ?? null : row?.car_company_id ?? this.companyId() });
        if (this.kind() === 'models') { this.form.controls.parent_id.addValidators(Validators.required); this.form.controls.parent_id.updateValueAndValidity(); }
    }
    invalid(field: 'name_en' | 'name_ar'): boolean { return Boolean(this.errors()[field]) || (this.submitted() && this.form.controls[field].invalid); }
    fieldError(field: 'name_en' | 'name_ar'): string { return this.errors()[field] || (this.invalid(field) ? this.locale.t('catalogNameRequired') : ''); }
    close(): void { if (!this.saving()) this.closed.emit(this.mustRefresh()); }
    submit(): void {
        if (this.saving() || this.mustRefresh()) return;
        this.submitted.set(true); this.error.set(''); this.errors.set({});
        this.form.patchValue({ name_en: this.form.controls.name_en.value.trim(), name_ar: this.form.controls.name_ar.value.trim() });
        this.form.updateValueAndValidity();
        if (!this.deleting() && this.form.invalid) return;
        const row = this.row(), value = this.form.getRawValue();
        const request: Observable<ApiEnvelope<CatalogRow | null>> = this.deleting() && row ? this.api.remove(this.kind(), row) : this.api.save(this.kind(), {
            name_en: value.name_en, name_ar: value.name_ar,
            ...(this.kind() === 'companies' ? { country_id: value.parent_id } : { car_company_id: value.parent_id }),
            ...(row ? { version: row.version } : {})
        }, row?.id);
        this.saving.set(true); this.form.disable();
        request.pipe(takeUntilDestroyed(this.destroyRef), finalize(() => { this.saving.set(false); this.form.enable(); })).subscribe({
            next: response => {
                if (!response.success) { this.mustRefresh.set(true); this.error.set(this.locale.t('catalogUncertain')); return; }
                this.saved.emit();
            },
            error: error => {
                if (error instanceof HttpErrorResponse && error.status === 422) {
                    const fields = error.error?.errors;
                    this.errors.set(Object.fromEntries(Object.entries(fields ?? {}).filter(([, value]) => Array.isArray(value) && typeof value[0] === 'string').map(([key, value]) => [key, (value as string[])[0]])));
                    this.error.set(typeof error.error?.message === 'string' ? error.error.message : this.locale.t('catalogCheckFields'));
                } else if (error instanceof HttpErrorResponse && [403, 404, 409, 429].includes(error.status)) {
                    this.mustRefresh.set(error.status === 404 || error.status === 409);
                    this.error.set(typeof error.error?.message === 'string' ? error.error.message : errorMessage(error, this.locale));
                } else {
                    this.mustRefresh.set(true); this.error.set(this.locale.t('catalogUncertain'));
                }
            }
        });
    }
}

import { locationLink, storeMediaPath } from '../../shared/store-links';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, combineLatest, filter, map, of, switchMap } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { TextareaModule } from 'primeng/textarea';
import { LocaleService, TextKey } from '../../core/locale.service';
import { PrivateImageComponent } from '../../shared/private-image.component';
import { userDate } from '../users/user-api.service';
import { requestError, ReviewFields, StoreRequest, StoreRequestApi } from './store-request-api.service';
import { RequestStatusComponent } from './request-status.component';

@Component({
    selector: 'app-store-request-detail',
    imports: [RouterLink, ReactiveFormsModule, ButtonModule, DialogModule, MessageModule, SkeletonModule, TextareaModule, PrivateImageComponent, RequestStatusComponent],
    templateUrl: './store-request-detail.component.html', styleUrls: ['../users/users.scss', './store-requests.scss']
})
export class StoreRequestDetailComponent {
    readonly locale = inject(LocaleService);
    private readonly route = inject(ActivatedRoute);
    private readonly api = inject(StoreRequestApi);
    private readonly destroyRef = inject(DestroyRef);
    private readonly reload = signal(0);
    readonly data = signal<StoreRequest | null>(null);
    readonly loading = signal(true);
    readonly error = signal('');
    readonly unavailable = signal(false);
    readonly saving = signal(false);
    readonly action = signal<'accept' | 'reject' | null>(null);
    readonly needsRefresh = signal(false);
    readonly mutationError = signal('');
    readonly updated = signal(false);
    readonly reason = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(255), Validators.pattern(/\S/)] });
    readonly safeLocation = locationLink;
    readonly mediaPath = storeMediaPath;
    readonly fields: { key: keyof Pick<ReviewFields, 'name' | 'nick_name' | 'employee_name' | 'mobile' | 'commercial_registration_number' | 'url_location'>; label: TextKey }[] = [
        { key: 'name', label: 'storeName' }, { key: 'nick_name', label: 'storeNickname' },
        { key: 'employee_name', label: 'storeContact' }, { key: 'mobile', label: 'storePhone' },
        { key: 'commercial_registration_number', label: 'registrationNumber' }, { key: 'url_location', label: 'storeLocation' }
    ];
    readonly comparison = computed(() => {
        const request = this.data();
        if (!request?.previous_details) return [];
        const before = request.previous_details;
        const rows = this.fields.map(field => ({ label: field.label, before: before[field.key] || '—', after: request[field.key] || '—', changed: before[field.key] !== request[field.key] }));
        rows.push({ label: 'city', before: request.previous_city?.name ?? this.locale.t('notProvided'), after: request.city?.name ?? this.locale.t('notProvided'), changed: before.city_id !== request.city?.id });
        rows.push({ label: 'carBrands', before: this.brands(before.company_ids), after: this.brands(request.company_ids), changed: JSON.stringify([...(before.company_ids ?? [])].sort()) !== JSON.stringify([...(request.company_ids ?? [])].sort()) });
        return rows;
    });
    date(value: string): string { return userDate(value, this.locale.language(), true); }
    brands(ids: number[] | undefined): string {
        return ids?.length ? ids.map(id => this.data()?.review_companies?.find(company => company.id === id)?.name ?? `${this.locale.t('notProvided')} (#${id})`).join('، ') : this.locale.t('notProvided');
    }

    constructor() {
        combineLatest([this.route.paramMap, toObservable(this.locale.language), toObservable(this.reload)]).pipe(
            filter(() => !this.saving()),
            switchMap(([params]) => {
                const id = Number(params.get('id'));
                this.loading.set(true); this.error.set(''); this.unavailable.set(false); this.data.set(null); this.action.set(null);
                if (!Number.isSafeInteger(id) || id <= 0) return of({ data: null, unavailable: true, error: '' });
                return this.api.get(id).pipe(map(data => ({ data, unavailable: false, error: '' })),
                    catchError(error => of({ data: null, unavailable: error instanceof HttpErrorResponse && error.status === 404, error: requestError(error, this.locale) })));
            }), takeUntilDestroyed()
        ).subscribe(result => {
            this.data.set(result.data); this.unavailable.set(result.unavailable); this.error.set(result.error); this.loading.set(false);
            if (result.data) { this.needsRefresh.set(false); this.mutationError.set(''); }
        });
    }
    refresh(): void { if (!this.saving()) { this.action.set(null); this.reload.update(value => value + 1); } }
    ask(action: 'accept' | 'reject'): void {
        if (this.data()?.request_status !== 'pending' || this.saving() || this.needsRefresh()) return;
        this.updated.set(false); this.reason.reset(''); this.mutationError.set(''); this.action.set(action);
    }
    confirm(): void {
        const request = this.data(), action = this.action();
        if (!request || !action || request.request_status !== 'pending' || this.saving() || this.needsRefresh()) return;
        if (action === 'reject' && (this.reason.invalid || !this.reason.value.trim())) { this.reason.markAsTouched(); return; }
        this.saving.set(true);
        this.api.review(request.id, action, this.reason.value.trim()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: () => { this.saving.set(false); this.action.set(null); this.updated.set(true); this.refresh(); },
            error: error => {
                this.saving.set(false); this.needsRefresh.set(true);
                this.mutationError.set(error instanceof HttpErrorResponse && error.status === 409 ? this.locale.t('reviewConflict')
                    : error instanceof HttpErrorResponse && error.status === 403 ? this.locale.t('requestsDenied')
                    : error instanceof HttpErrorResponse && error.status === 422 && typeof error.error?.message === 'string'
                        ? `${error.error.message} ${this.locale.t('reviewUncertain')}` : this.locale.t('reviewUncertain'));
            }
        });
    }
}

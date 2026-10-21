import { Component, computed, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { LocaleService } from '../../core/locale.service';
import { BilingualReference, ReferenceOption, ReferenceOptions } from '../../core/reference-options.service';

@Component({
    selector: 'app-company-select', imports: [FormsModule, SelectModule, ButtonModule],
    template: `
        <p-select [inputId]="inputId()" [ariaLabel]="locale.t('carCompany')"
            [ngModel]="value()" [ngModelOptions]="{standalone: true}" (onChange)="valueChange.emit($event.value ?? null)"
            [options]="options()" optionLabel="name" optionValue="id" [showClear]="true"
            [filter]="true" filterBy="search" [ariaFilterLabel]="locale.t('searchCompanies')"
            [filterPlaceholder]="locale.t('searchCompanies')" [resetFilterOnHide]="true"
            [placeholder]="locale.t('allCompanies')" [loading]="loading()"
            [emptyMessage]="locale.t(loading() ? 'loadingCompanies' : error() ? 'companyOptionsError' : 'noCompanyOptions')"
            [emptyFilterMessage]="locale.t(loading() ? 'loadingCompanies' : error() ? 'companyOptionsError' : 'noCompanyOptions')"
            (onShow)="load()" appendTo="body">
            <ng-template #footer>
                @if (error()) { <div class="options-footer"><button pButton type="button" severity="secondary" [text]="true" [label]="locale.t('retry')" (click)="load()"></button></div> }
            </ng-template>
        </p-select>
    `,
    styles: `:host { display: block; min-width: 0; } p-select { width: 100%; min-height: 46px; align-items: center; font-size: 13px; } .options-footer { padding: 8px 12px; }`
})
export class CompanySelectComponent {
    readonly locale = inject(LocaleService);
    private readonly catalog = inject(ReferenceOptions);
    private readonly destroyRef = inject(DestroyRef);
    readonly inputId = input('company-filter');
    readonly value = input<number | null>(null);
    readonly knownCompany = input<ReferenceOption | null>(null);
    readonly valueChange = output<number | null>();
    private readonly companies = signal<BilingualReference[] | null>(null);
    readonly loading = signal(false);
    readonly error = signal(false);
    readonly options = computed(() => {
        if (this.companies()) return this.companies()!.map(company => ({ id: company.id,
            name: this.locale.language() === 'ar' ? company.name_ar : company.name_en, search: `${company.name_en} ${company.name_ar}` }));
        const id = this.value();
        if (!id) return [];
        const known = this.catalog.find('admin/car-companies/options', this.locale.language(), id)
            ?? (this.knownCompany()?.id === id ? this.knownCompany() : null)
            ?? { id, name: `${this.locale.t('carCompany')} #${id}` };
        return [{ ...known, search: known.name }];
    });
    load(): void {
        if (this.loading() || this.companies()) return;
        this.loading.set(true); this.error.set(false);
        this.catalog.load('admin/car-companies/options').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: companies => { this.companies.set(companies); this.loading.set(false); },
            error: () => { this.loading.set(false); this.error.set(true); }
        });
    }
}

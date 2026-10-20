import { Component, computed, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { ButtonModule } from 'primeng/button';
import { CatalogCity, CityCatalog, CityOption } from '../core/city-catalog.service';
import { LocaleService } from '../core/locale.service';

@Component({
    selector: 'app-city-select',
    imports: [FormsModule, AutoCompleteModule, ButtonModule],
    template: `
        <p-autocomplete [inputId]="inputId()" [ariaLabel]="locale.t('city')"
            [ngModel]="selected()" [ngModelOptions]="{standalone: true}"
            (onSelect)="valueChange.emit($event.value.id)" (onClear)="valueChange.emit(null)"
            [suggestions]="options()" optionLabel="name" dataKey="id" [forceSelection]="true"
            [dropdown]="true" [dropdownAriaLabel]="locale.t('browseCities')" dropdownMode="blank"
            [showClear]="true" [minLength]="0" [delay]="0" [completeOnFocus]="false"
            [placeholder]="locale.t('allCities')" [emptyMessage]="locale.t(loading() ? 'loadingCities' : error() ? 'citiesError' : 'noCities')"
            [showEmptyMessage]="true" appendTo="body" (completeMethod)="search($event.query)">
            <ng-template #footer>
                @if (error()) { <div class="city-footer"><button pButton type="button" severity="secondary" [text]="true" [label]="locale.t('retryCities')" (click)="load()"></button></div> }
            </ng-template>
        </p-autocomplete>
    `,
    styles: `:host { display: block; min-width: 0; } p-autocomplete { width: 100%; min-height: 46px; } :host ::ng-deep .p-autocomplete-input { width: 100%; min-width: 0; font-size: 13px; } .city-footer { padding: 8px 12px; }`
})
export class CitySelectComponent {
    readonly locale = inject(LocaleService);
    private readonly catalog = inject(CityCatalog);
    private readonly destroyRef = inject(DestroyRef);
    readonly inputId = input('city-filter');
    readonly value = input<number | null>(null);
    readonly knownCity = input<CityOption | null>(null);
    readonly valueChange = output<number | null>();
    private readonly cities = signal<CatalogCity[] | null>(null);
    // PrimeNG expects a fresh suggestion array even when the same browse query is repeated.
    private readonly query = signal('', { equal: () => false });
    readonly loading = signal(false);
    readonly error = signal(false);
    readonly options = computed(() => {
        const query = this.query().trim().toLocaleLowerCase();
        if (this.loading() || this.error()) return [];
        const arabic = this.locale.language() === 'ar';
        return (this.cities() ?? []).filter(city => city.name_en.toLocaleLowerCase().includes(query) || city.name_ar.includes(query))
            .map(city => ({ id: city.id, name: arabic ? city.name_ar : city.name_en }));
    });
    readonly selected = computed(() => {
        const id = this.value();
        if (!id) return null;
        const city = this.cities()?.find(city => city.id === id);
        return (city ? { id, name: this.locale.language() === 'ar' ? city.name_ar : city.name_en } : undefined)
            ?? this.catalog.find(this.locale.language(), id)
            ?? (this.knownCity()?.id === id ? this.knownCity() : null)
            ?? { id, name: `${this.locale.t('city')} #${id}` };
    });

    search(query: string): void {
        this.query.set(query);
        if (!this.cities() && !this.error()) this.load();
    }

    load(): void {
        if (this.loading() || this.cities()) return;
        this.loading.set(true); this.error.set(false);
        this.catalog.load().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: cities => { this.cities.set(cities); this.loading.set(false); },
            error: () => { this.loading.set(false); this.error.set(true); }
        });
    }
}

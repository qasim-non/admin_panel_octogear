import { inject, Injectable } from '@angular/core';
import { BilingualReference, ReferenceOption, ReferenceOptions } from './reference-options.service';

export type CityOption = ReferenceOption;
export type CatalogCity = BilingualReference;

@Injectable({ providedIn: 'root' })
export class CityCatalog {
    private readonly options = inject(ReferenceOptions);
    load() { return this.options.load('admin/cities/options'); }
    find(language: string, id: number): CityOption | undefined {
        return this.options.find('admin/cities/options', language, id);
    }
}

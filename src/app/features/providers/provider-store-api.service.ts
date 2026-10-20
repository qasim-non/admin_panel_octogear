import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from '../../core/api-client';

export interface ProviderStore {
    id: number;
    name: string;
    mobile: string;
    status: 'active' | 'inactive';
    owner: { id: number; full_name: string; mobile: string };
    city: { id: number; name: string } | null;
}

@Injectable({ providedIn: 'root' })
export class ProviderStoreApi {
    private readonly api = inject(ApiClient);

    list(ownerId: number, page: number) {
        return this.api.get<ProviderStore[]>('admin/stores', { owner_id: ownerId, page }).pipe(map(response => {
            // Do not present unrelated stores if an older API ignores the owner filter.
            if (!response.success || !Array.isArray(response.data) || !response.meta
                || response.data.some(store => store.owner?.id !== ownerId)) {
                throw new Error('Invalid provider stores response');
            }
            return { stores: response.data, meta: response.meta };
        }));
    }
}

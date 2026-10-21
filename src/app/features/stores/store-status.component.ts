import { Component, inject, input } from '@angular/core';
import { TagModule } from 'primeng/tag';
import { LocaleService } from '../../core/locale.service';
import { StoreStatus } from './store-api.service';

@Component({
    selector: 'app-store-status', imports: [TagModule],
    template: `<p-tag [value]="locale.t(status() === 'active' ? 'activeStore' : 'inactiveStore')"
        [icon]="status() === 'active' ? 'pi pi-check-circle' : 'pi pi-pause-circle'"
        [severity]="status() === 'active' ? 'success' : 'secondary'"/>`
})
export class StoreStatusComponent { readonly locale = inject(LocaleService); readonly status = input.required<StoreStatus>(); }

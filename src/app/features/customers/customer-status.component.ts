import { Component, inject, input } from '@angular/core';
import { TagModule } from 'primeng/tag';
import { LocaleService } from '../../core/locale.service';
import { CustomerStatus } from './customer-api.service';

@Component({
    selector: 'app-customer-status', imports: [TagModule],
    template: `<p-tag [value]="locale.t(status() === 'blocked' ? 'blockedStatus' : 'unblocked')"
        [icon]="status() === 'blocked' ? 'pi pi-ban' : 'pi pi-check-circle'"
        [severity]="status() === 'blocked' ? 'danger' : 'success'"/>`
})
export class CustomerStatusComponent {
    readonly locale = inject(LocaleService);
    readonly status = input.required<CustomerStatus>();
}

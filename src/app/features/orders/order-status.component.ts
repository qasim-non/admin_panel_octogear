import { Component, inject, input } from '@angular/core';
import { TagModule } from 'primeng/tag';
import { LocaleService } from '../../core/locale.service';
import { OrderStatus, statusKeys } from './order-api.service';

@Component({
    selector: 'app-order-status', imports: [TagModule],
    template: `<p-tag [value]="locale.t(keys[status()])" [severity]="status() === 'completed' ? 'success' : status() === 'paid' ? 'info' : status() === 'pending' ? 'warn' : 'secondary'"/>`
})
export class OrderStatusComponent {
    readonly status = input.required<OrderStatus>(); readonly locale = inject(LocaleService); readonly keys = statusKeys;
}

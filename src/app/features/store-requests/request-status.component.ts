import { Component, inject, input } from '@angular/core';
import { TagModule } from 'primeng/tag';
import { LocaleService } from '../../core/locale.service';
import { RequestStatus } from './store-request-api.service';

@Component({
    selector: 'app-request-status', imports: [TagModule],
    template: `<p-tag [value]="locale.t(status() === 'accepted' ? 'requestAccepted' : status() === 'rejected' ? 'requestRejected' : 'pending')"
        [severity]="status() === 'accepted' ? 'success' : status() === 'rejected' ? 'danger' : 'warn'"
        [icon]="status() === 'accepted' ? 'pi pi-check-circle' : status() === 'rejected' ? 'pi pi-times-circle' : 'pi pi-clock'"/>`
})
export class RequestStatusComponent { readonly locale = inject(LocaleService); readonly status = input.required<RequestStatus>(); }

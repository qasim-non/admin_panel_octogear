import { SessionService } from '../../core/session.service';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { LocaleService } from '../../core/locale.service';

@Component({
    selector: 'app-status', imports: [RouterLink, ButtonModule],
    template: `<main class="status-page"><img src="brand/octogear.png" alt="OctoGear" width="72" height="72"><p class="eyebrow">{{ denied ? '403' : '404' }}</p><h1>{{ locale.t(denied ? 'accessDenied' : 'notFound') }}</h1><p>{{ locale.t(denied ? 'accessDeniedBody' : 'notFoundBody') }}</p><a pButton [routerLink]="session.profile() ? session.home() : '/login'">{{ locale.t('back') }}</a></main>`
})
export class StatusComponent {
    readonly session = inject(SessionService);
    readonly locale = inject(LocaleService);
    readonly denied = inject(ActivatedRoute).snapshot.data['denied'] === true;
}

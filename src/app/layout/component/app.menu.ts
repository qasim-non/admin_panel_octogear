import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LocaleService } from '../../core/locale.service';

@Component({
 selector: 'app-menu', imports: [RouterLink, RouterLinkActive],
 template: `<nav id="main-navigation" [attr.aria-label]="locale.t('workspace')"><p class="nav-label">{{ locale.t('workspace') }}</p><ul class="octogear-menu"><li><a routerLink="/overview" routerLinkActive="active-route" ariaCurrentWhenActive="page"><i class="pi pi-th-large" aria-hidden="true"></i>{{ locale.t('overview') }}</a></li></ul></nav>`
})
export class AppMenu { readonly locale = inject(LocaleService); }


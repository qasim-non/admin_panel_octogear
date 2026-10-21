import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LocaleService } from '../../core/locale.service';

@Component({
 selector: 'app-menu', imports: [RouterLink, RouterLinkActive],
 styles: [':host { display: block; }'],
 template: `<nav id="main-navigation" [attr.aria-label]="locale.t('workspace')"><p class="nav-label">{{ locale.t('workspace') }}</p><ul class="octogear-menu"><li><a routerLink="/overview" routerLinkActive="active-route" ariaCurrentWhenActive="page"><i class="pi pi-th-large" aria-hidden="true"></i>{{ locale.t('overview') }}</a></li><li><a routerLink="/customers" routerLinkActive="active-route" ariaCurrentWhenActive="page"><i class="pi pi-users" aria-hidden="true"></i>{{ locale.t('customers') }}</a></li><li><a routerLink="/providers" routerLinkActive="active-route" ariaCurrentWhenActive="page"><i class="pi pi-briefcase" aria-hidden="true"></i>{{ locale.t('providers') }}</a></li><li><a routerLink="/store-requests" routerLinkActive="active-route" ariaCurrentWhenActive="page"><i class="pi pi-clipboard" aria-hidden="true"></i>{{ locale.t('storeRequests') }}</a></li><li><a routerLink="/stores" routerLinkActive="active-route" ariaCurrentWhenActive="page"><i class="pi pi-shop" aria-hidden="true"></i>{{ locale.t('stores') }}</a></li><li><a routerLink="/orders" routerLinkActive="active-route" ariaCurrentWhenActive="page"><i class="pi pi-box" aria-hidden="true"></i>{{ locale.t('orders') }}</a></li></ul></nav>`
})
export class AppMenu { readonly locale = inject(LocaleService); }


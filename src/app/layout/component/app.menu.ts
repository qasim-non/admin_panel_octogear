import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LocaleService } from '../../core/locale.service';
import { SessionService } from '../../core/session.service';
import { TextKey } from '../../core/i18n/en';

@Component({ selector: 'app-menu', imports: [RouterLink, RouterLinkActive], styles: [':host { display: block; }'],
    template: `<nav id="main-navigation" [attr.aria-label]="locale.t('workspace')"><p class="nav-label">{{ locale.t('workspace') }}</p><ul class="octogear-menu">
    @for (item of items; track item.path) { @if (session.can(item.permission)) { <li><a [routerLink]="item.path" routerLinkActive="active-route" ariaCurrentWhenActive="page"><i [class]="'pi ' + item.icon" aria-hidden="true"></i>{{ locale.t(item.label) }}</a></li> } }
    </ul></nav>` })
export class AppMenu {
    readonly locale = inject(LocaleService); readonly session = inject(SessionService);
    readonly items: { path: string; label: TextKey; icon: string; permission: string }[] = [
        { path: '/overview', label: 'overview', icon: 'pi-th-large', permission: 'dashboard.view' },
        { path: '/customers', label: 'customers', icon: 'pi-users', permission: 'users.view' },
        { path: '/providers', label: 'providers', icon: 'pi-briefcase', permission: 'users.view' },
        { path: '/store-requests', label: 'storeRequests', icon: 'pi-clipboard', permission: 'requests.view' },
        { path: '/stores', label: 'stores', icon: 'pi-shop', permission: 'stores.view' },
        { path: '/orders', label: 'orders', icon: 'pi-box', permission: 'orders.view' },
        { path: '/payments', label: 'payments', icon: 'pi-wallet', permission: 'payments.view' },
        { path: '/chats', label: 'supportChats', icon: 'pi-comments', permission: 'support.access' },
        { path: '/sub-admins', label: 'subAdmins', icon: 'pi-user-edit', permission: 'admins.view' },
        { path: '/car-companies', label: 'carCompanies', icon: 'pi-building', permission: 'catalog.view' },
        { path: '/car-models', label: 'carModels', icon: 'pi-car', permission: 'catalog.view' }
    ];
}

import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { LocaleService } from '../../core/locale.service';
import { SessionService } from '../../core/session.service';
import { LayoutService } from '../service/layout.service';

@Component({
 selector: 'app-topbar', imports: [RouterLink, ButtonModule, MessageModule],
 template: `<header class="layout-topbar">
 <div class="topbar-start"><button pButton type="button" severity="secondary" [text]="true" icon="pi pi-bars" [attr.aria-label]="locale.t('menu')" [attr.aria-expanded]="layout.isDesktop() ? !layout.layoutState().staticMenuDesktopInactive : layout.layoutState().mobileMenuActive" aria-controls="main-navigation" (click)="layout.onMenuToggle()"></button>
 <a class="layout-topbar-logo" routerLink="/overview"><img src="brand/octogear.png" alt="" width="40" height="40"><span dir="ltr">OCTOGEAR</span><span class="admin-label">{{ locale.t('administration') }}</span></a></div>
 <div class="topbar-end"><button pButton severity="secondary" [text]="true" (click)="locale.toggle()">{{ locale.t('language') }}</button><span class="account-name">{{ session.profile()?.name }}</span><button pButton severity="secondary" [outlined]="true" icon="pi pi-sign-out" [label]="locale.t('signOut')" [loading]="session.busy()" [disabled]="session.busy()" (click)="logout()"></button></div>
 @if (error()) { <div class="logout-error" role="alert"><p-message severity="error">{{ error() }}</p-message></div> }
 </header>`
})
export class AppTopbar {
 readonly locale = inject(LocaleService);
 readonly session = inject(SessionService);
 readonly layout = inject(LayoutService);
 readonly error = signal('');
 async logout(): Promise<void> {
  this.error.set('');
  try { await this.session.logout(); } catch { if (this.session.profile()) this.error.set(this.locale.t('signOutFailed')); }
 }
}




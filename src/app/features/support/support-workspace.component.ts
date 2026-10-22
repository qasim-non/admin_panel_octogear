import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { LocaleService, TextKey } from '../../core/locale.service';
import { SupportConnection, SupportRealtime } from './support-realtime.service';

@Component({ selector: 'app-support-workspace', imports: [RouterOutlet, ButtonModule], providers: [SupportRealtime],
    styles: [`.connection { display:flex; align-items:center; justify-content:flex-end; gap:10px; margin-bottom:12px; color:#536078; font-size:12px; flex-wrap:wrap; } .dot {width:8px;height:8px;border-radius:50%;background:#a56b14;} .dot.live {background:#28754d;} .connection button {font-size:12px;}`],
    template: `<div class="connection" role="status"><span class="dot" [class.live]="realtime.status() === 'live'" aria-hidden="true"></span><span>{{ locale.t(labels[realtime.status()]) }}</span>@if (realtime.status() !== 'live' && realtime.status() !== 'connecting') { <button pButton severity="secondary" [text]="true" [label]="locale.t('supportReconnect')" (click)="realtime.reconnect()"></button> }</div><router-outlet/>` })
export class SupportWorkspaceComponent {
    readonly realtime = inject(SupportRealtime); readonly locale = inject(LocaleService);
    readonly labels: Record<SupportConnection, TextKey> = { live: 'supportLive', connecting: 'supportConnecting', offline: 'supportOffline', disabled: 'supportManual', denied: 'supportConnectionDenied' };
}

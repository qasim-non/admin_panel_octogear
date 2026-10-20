import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { SessionService } from './app/core/session.service';
import { LocaleService } from './app/core/locale.service';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterModule, ButtonModule],
    template: `@if (session.restoreFailed()) {
        <main class="session-recovery"><img src="brand/octogear.png" alt="OctoGear" width="64" height="64">
            <h1>{{ locale.t('restoreTitle') }}</h1><p role="alert">{{ locale.t('restoreBody') }}</p>
            <button pButton type="button" (click)="reload()">{{ locale.t('retry') }}</button>
        </main>
    } @else { <router-outlet></router-outlet> }`,
    styles: `.session-recovery { max-width: 32rem; margin: 15vh auto; padding: 2rem; text-align: center; } .session-recovery h1 { font-size: 1.5rem; } .session-recovery p { line-height: 1.8; margin-block: 1rem 2rem; }`
})
export class AppComponent {
    readonly session = inject(SessionService);
    readonly locale = inject(LocaleService);
    reload(): void { window.location.reload(); }
}

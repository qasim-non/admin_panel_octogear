import { Component, computed, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AppTopbar } from './app.topbar';
import { AppSidebar } from './app.sidebar';
import { AppFooter } from './app.footer';
import { LayoutService } from '@/app/layout/service/layout.service';
import { LocaleService } from '../../core/locale.service';
import { HostListener, OnDestroy } from '@angular/core';

@Component({
    selector: 'app-layout',
    standalone: true,
    imports: [CommonModule, AppTopbar, AppSidebar, RouterModule, AppFooter],
    template: `<a class="skip-link" href="#main-content">{{ locale.t('skip') }}</a><div class="layout-wrapper" [ngClass]="containerClass()">
        <app-topbar></app-topbar>
        <app-sidebar></app-sidebar>
        <div class="layout-main-container">
            <main class="layout-main" id="main-content" tabindex="-1">
                <router-outlet></router-outlet>
            </main>
            <app-footer></app-footer>
        </div>
        <div class="layout-mask"></div>
    </div> `
})
export class AppLayout implements OnDestroy {
    layoutService = inject(LayoutService);
    locale = inject(LocaleService);

    @HostListener('document:keydown.escape') closeMenu() {
        this.layoutService.layoutState.update(state => ({ ...state, mobileMenuActive: false, overlayMenuActive: false }));
    }
    ngOnDestroy() { document.body.classList.remove('blocked-scroll'); this.closeMenu(); }

    constructor() {
        effect(() => {
            const state = this.layoutService.layoutState();
            if (state.mobileMenuActive) {
                document.body.classList.add('blocked-scroll');
            } else {
                document.body.classList.remove('blocked-scroll');
            }
        });
    }

    containerClass = computed(() => {
        const config = this.layoutService.layoutConfig();
        const state = this.layoutService.layoutState();
        return {
            'layout-overlay': config.menuMode === 'overlay',
            'layout-static': config.menuMode === 'static',
            'layout-static-inactive': state.staticMenuDesktopInactive && config.menuMode === 'static',
            'layout-overlay-active': state.overlayMenuActive,
            'layout-mobile-active': state.mobileMenuActive
        };
    })
}

import { Component, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { MessageModule } from 'primeng/message';
import { ApiClient } from '../core/api-client';
import { LocaleService } from '../core/locale.service';

@Component({
    selector: 'app-private-image', imports: [ButtonModule, DialogModule, MessageModule],
    template: `
        <button pButton severity="secondary" [outlined]="true" icon="pi pi-image" [label]="label()" (click)="open()"></button>
        <p-dialog [visible]="visible()" (visibleChange)="visible.set($event)" [header]="label()" [modal]="true" [draggable]="false"
            [style]="{width: '850px', maxWidth: 'calc(100vw - 32px)'}" [closeAriaLabel]="locale.t('close')">
            @if (loading()) { <p role="status">{{ locale.t('loadingDocument') }}</p> }
            @else if (error()) { <div class="error-panel"><p-message severity="error">{{ locale.t('documentError') }}</p-message><button pButton [label]="locale.t('retry')" (click)="load()"></button></div> }
            @else if (url()) { <img [src]="url()" [alt]="label()"/> }
        </p-dialog>`,
    styles: ['img { display: block; width: 100%; max-height: 70vh; object-fit: contain; } button { font-size: 12px; }']
})
export class PrivateImageComponent {
    readonly path = input.required<string>();
    readonly label = input.required<string>();
    readonly locale = inject(LocaleService);
    private readonly api = inject(ApiClient);
    private readonly destroyRef = inject(DestroyRef);
    private subscription?: Subscription;
    readonly visible = signal(false);
    readonly loading = signal(false);
    readonly error = signal(false);
    readonly url = signal<string | null>(null);

    constructor() {
        effect(() => { this.path(); untracked(() => { this.clear(); this.visible.set(false); }); });
        this.destroyRef.onDestroy(() => this.clear());
    }
    open(): void { this.visible.set(true); if (!this.url()) this.load(); }
    load(): void {
        if (this.loading()) return;
        this.loading.set(true); this.error.set(false);
        this.subscription = this.api.image(this.path()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: blob => {
                this.loading.set(false);
                if (!['image/png', 'image/jpeg', 'image/webp'].includes(blob.type)) { this.error.set(true); return; }
                this.url.set(URL.createObjectURL(blob));
            },
            error: () => { this.loading.set(false); this.error.set(true); }
        });
    }
    private clear(): void {
        this.subscription?.unsubscribe();
        const url = this.url();
        if (url) URL.revokeObjectURL(url);
        this.url.set(null); this.loading.set(false); this.error.set(false);
    }
}

import { Component, DestroyRef, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { LocaleService } from '../../core/locale.service';
import { userDate } from '../users/user-api.service';
import { positiveId, SupportStatus, supportFilters, supportQuery } from './support-api.service';
import { SupportThread } from './support-thread.service';

@Component({ selector: 'app-support-detail', providers: [SupportThread], imports: [RouterLink, ButtonModule, DialogModule, TagModule],
    templateUrl: './support-detail.component.html', styleUrls: ['./support.scss'] })
export class SupportDetailComponent {
    readonly locale = inject(LocaleService); readonly thread = inject(SupportThread); private readonly route = inject(ActivatedRoute);
    readonly timeline = viewChild<ElementRef<HTMLElement>>('timeline'); readonly atBottom = signal(true); readonly active = signal(document.visibilityState === 'visible' && document.hasFocus());
    readonly latestEdge = viewChild<ElementRef<HTMLElement>>('latestEdge'); readonly latestVisible = signal(false);
    readonly auditOpen = signal(false); readonly invalid = signal(false); readonly query = signal(supportQuery(supportFilters(k => this.route.snapshot.queryParamMap.get(k))));
    readonly confirmation = signal<{ status: SupportStatus; version: number } | null>(null);
    readonly confirmationStatus = signal<SupportStatus>('closed');
    readonly count = computed(() => Array.from(this.thread.text().trim()).length);
    private lastId = 0; private scrollTimer?: ReturnType<typeof setTimeout>;
    constructor() {
        const destroy = inject(DestroyRef);
        this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(params => {
            const id = positiveId(params.get('id')); this.invalid.set(!id); this.lastId = 0; this.atBottom.set(true); this.auditOpen.set(false); this.confirmation.set(null);
            if (id) void this.thread.load(id);
        });
        this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(p => this.query.set(supportQuery(supportFilters(k => p.get(k)))));
        const foreground = () => this.active.set(document.visibilityState === 'visible' && document.hasFocus());
        document.addEventListener('visibilitychange', foreground); window.addEventListener('focus', foreground); window.addEventListener('blur', foreground);
        destroy.onDestroy(() => { clearTimeout(this.scrollTimer); document.removeEventListener('visibilitychange', foreground); window.removeEventListener('focus', foreground); window.removeEventListener('blur', foreground); });
        effect(() => {
            const messages = this.thread.messages(), element = this.timeline()?.nativeElement, latest = messages.at(-1)?.id ?? 0;
            if (element && latest !== this.lastId) {
                this.lastId = latest;
                if (this.atBottom()) { clearTimeout(this.scrollTimer); this.scrollTimer = setTimeout(() => this.toLatest(), 0); }
            }
        });
        effect(onCleanup => {
            const element = this.timeline()?.nativeElement; if (!element) return;
            const observer = new ResizeObserver(() => { if (this.atBottom()) this.toLatest(); else this.onScroll(); });
            observer.observe(element); onCleanup(() => observer.disconnect());
        });
        effect(onCleanup => {
            const edge = this.latestEdge()?.nativeElement; this.latestVisible.set(false); if (!edge) return;
            const observer = new IntersectionObserver(entries => this.latestVisible.set(entries[0]?.intersectionRatio === 1), { threshold: 1 });
            observer.observe(edge); onCleanup(() => observer.disconnect());
        });
        effect(onCleanup => {
            if (!this.active() || !this.atBottom() || !this.latestVisible() || this.confirmation() || this.thread.changingStatus() || this.thread.readError() || this.thread.reading() || !this.thread.readBoundary()) return;
            const timer = setTimeout(() => { if (this.active() && this.atBottom() && this.latestVisible()) void this.thread.markRead(); }, 1500);
            onCleanup(() => clearTimeout(timer));
        });
    }
    date(value: string | null): string { return value ? userDate(value.includes('T') ? value : value.replace(' ', 'T') + 'Z', this.locale.language(), true) : '—'; }
    number(value: number): string { return new Intl.NumberFormat(this.locale.language()).format(value); }
    edit(event: Event): void { this.thread.edit((event.target as HTMLTextAreaElement).value); }
    onScroll(): void { const e = this.timeline()?.nativeElement; if (e) this.atBottom.set(e.scrollHeight - e.scrollTop - e.clientHeight < 48); }
    toLatest(): void { const e = this.timeline()?.nativeElement; if (e) { e.scrollTop = e.scrollHeight; this.atBottom.set(true); } }
    async older(): Promise<void> {
        const e = this.timeline()?.nativeElement; if (!e) return;
        const height = e.scrollHeight, top = e.scrollTop; this.atBottom.set(false); await this.thread.older();
        clearTimeout(this.scrollTimer); this.scrollTimer = setTimeout(() => { e.scrollTop = top + e.scrollHeight - height; }, 0);
    }
    askStatus(): void { const c = this.thread.conversation(); if (c) { const status = c.status === 'open' ? 'closed' : 'open'; this.confirmationStatus.set(status); this.confirmation.set({ status, version: c.version }); } }
    confirmStatus(): void { const target = this.confirmation(); this.confirmation.set(null); if (target) void this.thread.changeStatus(target.status, target.version); }
    toggleAudit(): void { this.auditOpen.update(v => !v); if (this.auditOpen()) void this.thread.loadAudit(true); }
    retryRead(): void { if (this.active() && this.atBottom() && this.latestVisible()) void this.thread.markRead(); }
    async send(): Promise<void> { await this.thread.send(); if (!this.thread.text()) this.toLatest(); }
}

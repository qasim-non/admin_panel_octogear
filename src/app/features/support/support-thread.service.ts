import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom, Observable } from 'rxjs';
import { errorMessage } from '../../core/api-client';
import { LocaleService } from '../../core/locale.service';
import { SupportApi, SupportAudit, SupportConversation, SupportMessage, SupportStatus } from './support-api.service';
import { SupportDrafts } from './support-drafts.service';
import { SupportRealtime } from './support-realtime.service';

/** Route-scoped coordinator. Server versions protect summaries; HTTP cursors recover message gaps. */
@Injectable()
export class SupportThread {
    private readonly api = inject(SupportApi); private readonly locale = inject(LocaleService); private readonly drafts = inject(SupportDrafts);
    private readonly destroyRef = inject(DestroyRef); private generation = 0; private id = 0; private cursor = 0; private recoverAgain = false;
    private auditAgain = false;
    readonly conversation = signal<SupportConversation | null>(null); readonly messages = signal<SupportMessage[]>([]);
    readonly loading = signal(true); readonly syncing = signal(false); readonly olderLoading = signal(false); readonly hasOlder = signal(false);
    readonly error = signal(''); readonly historyError = signal(''); readonly actionError = signal(''); readonly readError = signal('');
    readonly text = signal(''); readonly pendingKey = signal<string | undefined>(undefined); readonly sending = signal(false);
    readonly changingStatus = signal(false); readonly statusBlocked = signal(false); readonly reading = signal(false);
    readonly audit = signal<SupportAudit[]>([]); readonly auditLoading = signal(false); readonly auditError = signal(''); readonly auditPage = signal(0); readonly auditHasMore = signal(false);
    constructor() {
        this.destroyRef.onDestroy(() => { this.generation++; });
        inject(SupportRealtime).events.pipe(takeUntilDestroyed()).subscribe(event => {
            if (event === 'connected') { void this.refresh(); return; }
            if (event.conversation.id !== this.id) return;
            this.mergeConversation(event.conversation);
            if (event.message) this.mergeMessages([event.message]);
            if (event.kind === 'message') void this.refresh();
            if (event.kind === 'status' && this.auditPage()) void this.loadAudit(true);
        });
    }
    private request<T>(value: Observable<T>): Promise<T> { return firstValueFrom(value.pipe(takeUntilDestroyed(this.destroyRef))); }
    async load(id: number): Promise<void> {
        const g = ++this.generation; this.id = id; this.cursor = 0; this.recoverAgain = false; this.auditAgain = false;
        this.conversation.set(null); this.messages.set([]); this.loading.set(true); this.syncing.set(false); this.olderLoading.set(false); this.hasOlder.set(false);
        this.error.set(''); this.historyError.set(''); this.actionError.set(''); this.readError.set(''); this.statusBlocked.set(false);
        this.sending.set(false); this.changingStatus.set(false); this.reading.set(false); this.audit.set([]); this.auditPage.set(0); this.auditHasMore.set(false); this.auditLoading.set(false); this.auditError.set('');
        const draft = this.drafts.get(id); this.text.set(draft.text); this.pendingKey.set(draft.key);
        try {
            const page = await this.request(this.api.timeline(id)); if (g !== this.generation) return;
            this.mergeConversation(page.conversation); this.mergeMessages(page.messages); this.hasOlder.set(page.has_more);
            this.cursor = Math.max(0, ...page.messages.map(m => m.id));
        } catch (error) { if (g === this.generation) this.error.set(errorMessage(error, this.locale)); }
        finally { if (g === this.generation) this.loading.set(false); }
        if (g === this.generation && this.conversation() && (this.recoverAgain || (this.conversation()?.last_message?.id ?? 0) > this.cursor)) void this.refresh();
    }
    async refresh(): Promise<void> {
        if (!this.id) return;
        if (this.loading() || this.syncing()) { this.recoverAgain = true; return; }
        if (!this.conversation()) { await this.load(this.id); return; }
        const g = this.generation; this.syncing.set(true); this.error.set('');
        try {
            let emptyCatchups = 0;
            do {
                this.recoverAgain = false;
                const page = await this.request(this.api.timeline(this.id, { after_id: this.cursor })); if (g !== this.generation) return;
                this.mergeConversation(page.conversation); this.mergeMessages(page.messages);
                const next = Math.max(this.cursor, ...page.messages.map(m => m.id));
                if (page.has_more && next <= this.cursor) throw new Error('Invalid support cursor');
                // A message can commit between the timeline query and its summary query.
                const behind = (this.conversation()?.last_message?.id ?? 0) > next;
                if (behind && next === this.cursor && ++emptyCatchups > 1) throw new Error('Support history could not be reconciled');
                this.cursor = next; this.recoverAgain ||= page.has_more || behind;
            } while (this.recoverAgain);
            this.statusBlocked.set(false);
        } catch (error) { if (g === this.generation) this.error.set(errorMessage(error, this.locale)); }
        finally { if (g === this.generation) this.syncing.set(false); }
    }
    async older(): Promise<void> {
        if (this.loading() || this.olderLoading() || !this.hasOlder()) return;
        const g = this.generation; this.olderLoading.set(true); this.historyError.set('');
        try {
            const page = await this.request(this.api.timeline(this.id, { before_id: this.messages()[0].id })); if (g !== this.generation) return;
            this.mergeConversation(page.conversation); this.mergeMessages(page.messages); this.hasOlder.set(page.has_more);
        } catch (error) { if (g === this.generation) this.historyError.set(errorMessage(error, this.locale)); }
        finally { if (g === this.generation) this.olderLoading.set(false); }
    }
    edit(text: string): void { if (!this.pendingKey() && !this.sending()) { this.text.set(text); this.saveDraft(); } }
    async send(): Promise<void> {
        const c = this.conversation(), content = this.text().trim();
        if (!c || this.sending() || this.changingStatus() || (!this.pendingKey() && c.status !== 'open') || !content || Array.from(content).length > 2000) return;
        const g = this.generation; this.text.set(content); this.pendingKey.set(this.pendingKey() ?? crypto.randomUUID()); this.saveDraft();
        this.sending.set(true); this.actionError.set('');
        try {
            const receipt = await this.request(this.api.send(this.id, content, this.pendingKey()!)); if (g !== this.generation) return;
            this.mergeConversation(receipt.conversation); this.mergeMessages([receipt.message]); this.text.set(''); this.pendingKey.set(undefined); this.saveDraft();
            void this.refresh();
        } catch (error) {
            if (g !== this.generation) return;
            // Definitive rejection permits editing. Uncertain delivery retains the exact body and UUID.
            if (error instanceof HttpErrorResponse && [400, 403, 404, 409, 422, 429].includes(error.status)) {
                this.pendingKey.set(undefined); this.saveDraft(); this.actionError.set(error.status === 409 ? this.locale.t('supportSendConflict') : errorMessage(error, this.locale));
                if (error.status === 409) void this.refresh();
            } else this.actionError.set(this.locale.t('supportSendUncertain'));
        } finally { if (g === this.generation) this.sending.set(false); }
    }
    async changeStatus(next: SupportStatus, version: number): Promise<void> {
        const c = this.conversation();
        if (!c || this.changingStatus() || this.sending() || this.pendingKey() || this.statusBlocked()) return;
        if (c.version !== version) { this.actionError.set(this.locale.t('supportStatusConflict')); return; }
        const g = this.generation; this.changingStatus.set(true); this.actionError.set('');
        try {
            const result = await this.request(this.api.status(this.id, next, version)); if (g !== this.generation) return;
            this.mergeConversation(result); if (this.auditPage()) void this.loadAudit(true);
        } catch (error) {
            if (g !== this.generation) return;
            this.statusBlocked.set(true);
            this.actionError.set(error instanceof HttpErrorResponse && error.status === 409 ? this.locale.t('supportStatusConflict') : this.locale.t('supportStatusUncertain'));
            void this.refresh();
        } finally { if (g === this.generation) this.changingStatus.set(false); }
    }
    readBoundary(): number {
        const c = this.conversation();
        if (!c || this.loading() || this.syncing() || this.error() || this.cursor < (c.last_message?.id ?? 0)) return 0;
        return this.cursor > c.support_read_through_id ? this.cursor : 0;
    }
    async markRead(): Promise<void> {
        const through = this.readBoundary(); if (!through || this.reading()) return;
        const g = this.generation; this.reading.set(true); this.readError.set('');
        try { const c = await this.request(this.api.read(this.id, through)); if (g === this.generation) this.mergeConversation(c); }
        catch (error) { if (g === this.generation) this.readError.set(errorMessage(error, this.locale)); }
        finally { if (g === this.generation) this.reading.set(false); }
    }
    async loadAudit(reset = false): Promise<void> {
        if (!this.conversation()) return;
        if (this.auditLoading()) { this.auditAgain ||= reset; return; }
        const g = this.generation, page = reset ? 1 : this.auditPage() + 1; this.auditLoading.set(true); this.auditError.set('');
        try {
            const result = await this.request(this.api.audit(this.id, page)); if (g !== this.generation) return;
            this.audit.set(reset ? result.rows : [...this.audit(), ...result.rows]); this.auditPage.set(page); this.auditHasMore.set(page < result.meta.last_page);
        } catch (error) { if (g === this.generation) this.auditError.set(errorMessage(error, this.locale)); }
        finally { if (g === this.generation) { this.auditLoading.set(false); if (this.auditAgain) { this.auditAgain = false; void this.loadAudit(true); } } }
    }
    private saveDraft(): void { this.drafts.set(this.id, { text: this.text(), key: this.pendingKey() }); }
    private mergeConversation(c: SupportConversation): void { if (c.id === this.id && c.version >= (this.conversation()?.version ?? 0)) this.conversation.set(c); }
    private mergeMessages(incoming: SupportMessage[]): void {
        const byId = new Map(this.messages().map(m => [m.id, m])); for (const m of incoming) byId.set(m.id, m);
        this.messages.set([...byId.values()].sort((a, b) => a.id - b.id));
    }
}

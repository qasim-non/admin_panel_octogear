import { effect, inject, Injectable } from '@angular/core';
import { SessionService } from '../../core/session.service';

export interface SupportDraft { text: string; key?: string; }
/** In-memory only, retained across navigation so an uncertain reply keeps its retry identity. */
@Injectable({ providedIn: 'root' })
export class SupportDrafts {
    private readonly session = inject(SessionService); private token: string | null = null;
    private readonly drafts = new Map<number, SupportDraft>();
    constructor() { effect(() => { this.session.profile(); this.ensureSession(); }); }
    private ensureSession(): void { const token = this.session.token(); if (token !== this.token) { this.drafts.clear(); this.token = token; } }
    get(id: number): SupportDraft { this.ensureSession(); return this.drafts.get(id) ?? { text: '' }; }
    set(id: number, value: SupportDraft): void { this.ensureSession(); if (value.text) this.drafts.set(id, value); else this.drafts.delete(id); }
}

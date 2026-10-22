import { Component, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { inject } from '@angular/core';
import { LocaleService } from '../core/locale.service';

export function temporaryPassword(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*-_';
    const limit = 256 - (256 % alphabet.length);
    for (;;) {
        let result = '';
        while (result.length < 16) {
            for (const byte of crypto.getRandomValues(new Uint8Array(32))) {
                if (byte < limit && result.length < 16) result += alphabet[byte % alphabet.length];
            }
        }
        if (/[A-Z]/.test(result) && /[a-z]/.test(result) && /[0-9]/.test(result) && /[!@#$%*_-]/.test(result)) return result;
    }
}

@Component({ selector: 'app-password-field', imports: [ReactiveFormsModule, ButtonModule, InputTextModule],
    styles: [`:host { display: block; } label { display: block; margin-bottom: .5rem; font-weight: 600; } .control { display:flex; align-items:center; gap:.4rem; } input { min-width:0; width:100%; } .tools { display:flex; flex-wrap:wrap; gap:.5rem; margin-top:.6rem; } small { display:block; margin-top:.5rem; color:var(--text-color-secondary); }`],
    template: `<label [for]="inputId()">{{ label() }}</label><div class="control"><input pInputText [id]="inputId()" [type]="revealed() ? 'text' : 'password'" [formControl]="control()" [autocomplete]="autocomplete()" dir="ltr" [readOnly]="busy() || locked()" [attr.aria-describedby]="inputId() + '-hint'" [attr.aria-invalid]="control().touched && control().invalid" />
    <button pButton type="button" severity="secondary" [text]="true" [icon]="revealed() ? 'pi pi-eye-slash' : 'pi pi-eye'" [attr.aria-label]="locale.t(revealed() ? 'hidePassword' : 'showPassword')" [attr.aria-pressed]="revealed()" (click)="revealed.set(!revealed())"></button></div>
    @if (generate() || copyable()) { <div class="tools">@if (generate()) { <button pButton type="button" severity="secondary" [outlined]="true" icon="pi pi-key" [disabled]="busy()" (click)="create()">{{ locale.t('generatePassword') }}</button> }<button pButton type="button" severity="secondary" [text]="true" icon="pi pi-copy" [disabled]="!control().value || busy()" (click)="copy()">{{ locale.t('copyPassword') }}</button></div> }
    <small [id]="inputId() + '-hint'">{{ hint() }}</small>@if (copyState()) { <small role="status">{{ locale.t(copyState() === 'done' ? 'passwordCopied' : 'passwordCopyFailed') }}</small> }` })
export class PasswordFieldComponent {
    readonly locale = inject(LocaleService);
    readonly control = input.required<FormControl<string>>();
    readonly inputId = input.required<string>(); readonly label = input.required<string>();
    readonly hint = input(''); readonly autocomplete = input('new-password');
    readonly copyable = input(false); readonly locked = input(false); readonly generate = input(false); readonly busy = input(false);
    readonly revealed = signal(false); readonly copyState = signal('');
    create(): void { this.control().setValue(temporaryPassword()); this.control().markAsDirty(); this.revealed.set(true); this.copyState.set(''); }
    async copy(): Promise<void> { try { await navigator.clipboard.writeText(this.control().value); this.copyState.set('done'); } catch { this.revealed.set(true); this.copyState.set('failed'); } }
}

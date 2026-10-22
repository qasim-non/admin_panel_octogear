import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { LocaleService } from '../../core/locale.service';
import { SessionService } from '../../core/session.service';
import { PasswordFieldComponent } from '../../shared/password-field.component';
import { accountError } from './admin-account-api';
import { roleKey, permissionKey } from './admin-labels';

@Component({ selector: 'app-account-settings', imports: [DatePipe, ReactiveFormsModule, ButtonModule, MessageModule, PasswordFieldComponent], styleUrls: ['../users/users.scss', './admin-accounts.scss'],
    template: `<header class="page-heading"><div><p class="eyebrow">{{ locale.t('administration') }}</p><h1>{{ locale.t('accountSettings') }}</h1><p>{{ locale.t('accountSettingsIntro') }}</p></div></header>
    <div class="settings-grid"><section class="settings-card"><h2>{{ locale.t('yourAccount') }}</h2>
    @if (session.profile(); as profile) { <dl class="staff-facts"><div><dt>{{ locale.t('adminName') }}</dt><dd>{{ profile.name }}</dd></div><div><dt>{{ locale.t('adminRole') }}</dt><dd>{{ locale.t(roleKey(profile.assigned_role)) }}</dd></div><div><dt>{{ locale.t('email') }}</dt><dd dir="ltr">{{ profile.email }}</dd></div><div><dt>{{ locale.t('passwordLastChanged') }}</dt><dd>{{ profile.password_changed_at ? (profile.password_changed_at | date:'mediumDate':'UTC') : locale.t('notProvided') }}</dd></div></dl>
    <h3>{{ locale.t('preferredLanguage') }}</h3><p>{{ profile.preferred_language === 'ar' ? 'العربية' : 'English' }}</p><button pButton severity="secondary" [outlined]="true" [loading]="session.languageSaving()" [disabled]="session.busy() || session.languageSaving()" (click)="session.toggleLanguage()">{{ locale.t('language') }}</button>
    <h3>{{ locale.t('rolePermissions') }}</h3><ul class="permission-list">@for (permission of profile.permissions; track permission) { <li><i class="pi pi-check" aria-hidden="true"></i>{{ locale.t(permissionKey(permission)) }}</li> }</ul> }
    </section><section class="settings-card"><h2>{{ locale.t('changePassword') }}</h2><p class="staff-note">{{ locale.t('changePasswordNotice') }}</p>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
    @if (error()) { <p-message severity="error">{{ error() }}</p-message> }
    <div class="staff-field"><app-password-field inputId="current-password" [control]="form.controls.current_password" [label]="locale.t('yourCurrentPassword')" autocomplete="current-password" [busy]="session.busy()" /></div>
    <div class="staff-field"><app-password-field inputId="new-password" [control]="form.controls.password" [label]="locale.t('newPassword')" [hint]="locale.t('securePasswordHint')" [busy]="session.busy()" /></div>
    <div class="staff-field"><app-password-field inputId="confirm-password" [control]="form.controls.password_confirmation" [label]="locale.t('confirmPassword')" [busy]="session.busy()" /></div>
    <button pButton type="submit" icon="pi pi-lock" [loading]="session.busy()" [disabled]="session.busy() || session.languageSaving()">{{ locale.t('changePassword') }}</button>
    </form></section></div>` })
export class AccountSettingsComponent {
    readonly locale = inject(LocaleService); readonly session = inject(SessionService); readonly roleKey = roleKey; readonly permissionKey = permissionKey;
    readonly error = signal('');
    readonly form = inject(FormBuilder).nonNullable.group({ current_password: ['', Validators.required], password: ['', [Validators.required, Validators.minLength(15), Validators.maxLength(72)]], password_confirmation: ['', Validators.required] });
    async save(): Promise<void> {
        this.error.set(''); this.form.markAllAsTouched();
        const { current_password, password, password_confirmation } = this.form.getRawValue();
        if (this.form.invalid || new TextEncoder().encode(password).length > 72) { this.error.set(this.locale.t('securePasswordHint')); return; }
        if (password !== password_confirmation) { this.error.set(this.locale.t('passwordMismatch')); return; }
        try { await this.session.changePassword(current_password, password, password_confirmation); this.form.reset(); }
        catch (error) { this.error.set(accountError(error, this.locale)); }
    }
}

import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { AppSettings } from '../../core/app-settings';
import { errorMessage } from '../../core/api-client';
import { LocaleService } from '../../core/locale.service';
import { SessionService } from '../../core/session.service';
import { PasswordFieldComponent } from '../../shared/password-field.component';
import { accountError } from '../admins/admin-account-api';

@Component({
    selector: 'app-login',
    imports: [ReactiveFormsModule, ButtonModule, DialogModule, InputTextModule, MessageModule, PasswordFieldComponent],
    templateUrl: './login.component.html',
    styleUrl: './login.component.scss'
})
export class LoginComponent {
    readonly locale = inject(LocaleService);
    readonly session = inject(SessionService);
    readonly settings = inject(AppSettings);
    private readonly router = inject(Router);
    readonly form = inject(FormBuilder).nonNullable.group({ email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]], password: ['', [Validators.required, Validators.minLength(6)]] });
    readonly reveal = signal(false);
    readonly error = signal('');
    readonly passwordChanged = inject(ActivatedRoute).snapshot.queryParamMap.has('passwordChanged');
    readonly setupForm = inject(FormBuilder).nonNullable.group({ password: ['', [Validators.required, Validators.minLength(15), Validators.maxLength(72)]], password_confirmation: ['', Validators.required] });
    recoveryVisible = false;

    invalid(field: 'email' | 'password'): boolean { const control = this.form.controls[field]; return control.invalid && control.touched; }
    async submit(): Promise<void> {
        this.error.set('');
        this.form.markAllAsTouched();
        if (this.form.invalid || this.session.busy() || this.settings.error()) return;
        try {
            const { email, password } = this.form.getRawValue();
            if (await this.session.login(email.trim(), password)) {
                this.form.controls.password.reset();
                await this.router.navigateByUrl(this.session.home());
            }
            if (this.session.needsPasswordSetup()) this.form.controls.password.reset();
        } catch (error) { this.error.set(errorMessage(error, this.locale)); }
    }
    async finishSetup(): Promise<void> {
        this.error.set(''); this.setupForm.markAllAsTouched();
        const { password, password_confirmation } = this.setupForm.getRawValue();
        if (this.setupForm.invalid || new TextEncoder().encode(password).length > 72) { this.error.set(this.locale.t('securePasswordHint')); return; }
        if (password !== password_confirmation) { this.error.set(this.locale.t('passwordMismatch')); return; }
        try {
            if (await this.session.completePasswordSetup(password, password_confirmation)) {
                this.setupForm.reset(); await this.router.navigateByUrl(this.session.home());
            }
        } catch (error) { this.error.set(accountError(error, this.locale)); }
    }
    backToLogin(): void { this.session.cancelSetup(); this.setupForm.reset(); this.error.set(''); }
    reload(): void { window.location.reload(); }
}

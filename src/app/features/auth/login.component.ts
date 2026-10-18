import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { AppSettings } from '../../core/app-settings';
import { errorMessage } from '../../core/api-client';
import { LocaleService } from '../../core/locale.service';
import { SessionService } from '../../core/session.service';

@Component({
    selector: 'app-login',
    imports: [ReactiveFormsModule, ButtonModule, DialogModule, InputTextModule, MessageModule],
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
                await this.router.navigateByUrl('/overview');
            }
        } catch (error) { this.error.set(errorMessage(error, this.locale)); }
    }
    reload(): void { window.location.reload(); }
}

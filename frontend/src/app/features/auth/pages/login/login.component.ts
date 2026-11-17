import { Location } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthLayoutComponent } from '../../components/auth-layout/auth-layout.component';
import { PasswordFieldComponent } from '../../../../shared/components/password-field/password-field.component';
import { AuthService } from '../../../../core/services/auth.service';

interface LoginNavigationState { registrationSuccess?: boolean; }

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [AuthLayoutComponent, PasswordFieldComponent, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  protected readonly loginForm = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
  protected rememberMe = false;
  protected notice = '';
  protected loading = false;
  private readonly returnUrl: string;

  constructor() {
    const state = (this.router.getCurrentNavigation()?.extras.state ?? this.location.getState()) as LoginNavigationState;
    if (state?.registrationSuccess) this.notice = 'Your teacher account is ready. Sign in with your registered email and password.';
    const requestedUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    this.returnUrl = requestedUrl?.startsWith('/') && !requestedUrl.startsWith('//') ? requestedUrl : '/dashboard';
  }
  protected submit(): void {
    this.loginForm.markAllAsTouched();
    if (this.loginForm.invalid || this.loading) return;
    this.notice = '';
    this.loading = true;
    this.authService.login({ email: this.email.value.trim(), password: this.password.value })
      .pipe(finalize(() => { this.loading = false; }))
      .subscribe({
        next: () => { void this.router.navigateByUrl(this.returnUrl); },
        error: (error: unknown) => { this.notice = AuthService.errorMessage(error, 'We could not sign you in. Check your email and password.'); },
      });
  }
  protected get email(): FormControl<string> { return this.loginForm.controls.email; }
  protected get password(): FormControl<string> { return this.loginForm.controls.password; }
}
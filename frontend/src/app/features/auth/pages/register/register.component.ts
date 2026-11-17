import { Component, inject } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthLayoutComponent } from '../../components/auth-layout/auth-layout.component';
import { PasswordFieldComponent } from '../../../../shared/components/password-field/password-field.component';
import { AuthService } from '../../../../core/services/auth.service';
import { finalize } from 'rxjs';

const passwordsMatch: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  return !confirmPassword || password === confirmPassword ? null : { passwordMismatch: true };
};

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [AuthLayoutComponent, PasswordFieldComponent, ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css',
})
export class RegisterComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly registrationForm = new FormGroup({
    fullName: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(2), Validators.maxLength(100)] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [
      Validators.required,
      Validators.minLength(8),
      Validators.pattern(/[A-Z]/),
      Validators.pattern(/[a-z]/),
      Validators.pattern(/[0-9]/),
      Validators.pattern(/[^A-Za-z0-9]/),
    ] }),
    confirmPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    termsAccepted: new FormControl(false, { nonNullable: true, validators: [Validators.requiredTrue] }),
  }, { validators: passwordsMatch });

  protected notice = '';
  protected submitting = false;

  protected get fullName(): FormControl<string> { return this.registrationForm.controls.fullName; }
  protected get email(): FormControl<string> { return this.registrationForm.controls.email; }
  protected get password(): FormControl<string> { return this.registrationForm.controls.password; }
  protected get confirmPassword(): FormControl<string> { return this.registrationForm.controls.confirmPassword; }
  protected get termsAccepted(): FormControl<boolean> { return this.registrationForm.controls.termsAccepted; }
  protected get passwordMismatch(): boolean {
    return this.confirmPassword.touched && this.registrationForm.hasError('passwordMismatch');
  }

  protected get passwordChecks(): { label: string; met: boolean }[] {
    const value = this.password.value;
    return [
      { label: 'At least 8 characters', met: value.length >= 8 },
      { label: 'One uppercase letter', met: /[A-Z]/.test(value) },
      { label: 'One lowercase letter', met: /[a-z]/.test(value) },
      { label: 'One number', met: /[0-9]/.test(value) },
      { label: 'One special character', met: /[^A-Za-z0-9]/.test(value) },
    ];
  }

  protected trimEmail(): void {
    const trimmed = this.email.value.trim();
    if (trimmed !== this.email.value) this.email.setValue(trimmed);
  }

  protected submit(): void {
    this.registrationForm.markAllAsTouched();
    this.trimEmail();
    if (this.registrationForm.invalid) return;

    this.notice = '';
    this.submitting = true;
    const { fullName, email, password } = this.registrationForm.getRawValue();

    this.authService.requestRegistrationOtp({ fullName: fullName.trim(), email: email.trim(), password })
      .pipe(finalize(() => { this.submitting = false; }))
      .subscribe({
        next: (response) => {
          if (!response?.registrationReference || !response.email) {
            this.notice = 'The server response was incomplete. Please try again.';
            return;
          }
          this.authService.saveRegistrationReference(response.registrationReference);
          void this.router.navigate(['/verify-otp'], {
            state: {
              registrationReference: response.registrationReference,
              email: response.email,
              resendCooldownSeconds: response.resendCooldownSeconds,
            },
          });
        },
        error: (error: unknown) => {
          this.notice = AuthService.errorMessage(error, 'We could not start your registration. Please try again.');
        },
      });
  }
}

import { Location } from '@angular/common';
import { Component, OnDestroy, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { AuthLayoutComponent } from '../../components/auth-layout/auth-layout.component';

interface RegistrationRouteState {
  registrationReference?: string;
  email?: string;
  resendCooldownSeconds?: number;
}

@Component({
  selector: 'app-verify-otp',
  standalone: true,
  imports: [AuthLayoutComponent, ReactiveFormsModule, RouterLink],
  templateUrl: './verify-otp.component.html',
  styleUrl: './verify-otp.component.css',
})
export class VerifyOtpComponent implements OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private countdownHandle?: ReturnType<typeof setInterval>;
  private redirectHandle?: ReturnType<typeof setTimeout>;
  private readonly routeState: RegistrationRouteState;

  protected readonly otp = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(6), Validators.maxLength(6), Validators.pattern(/^\d{6}$/)],
  });
  protected readonly registrationReference: string;
  protected readonly email: string;
  protected secondsUntilResend = 0;
  protected verifying = false;
  protected resending = false;
  protected message = '';
  protected messageKind: 'error' | 'success' | 'info' = 'info';
  protected contextMissing = false;

  constructor() {
    const state = (this.router.getCurrentNavigation()?.extras.state ?? this.location.getState()) as RegistrationRouteState | null;
    this.routeState = state ?? {};
    const routeReference = this.routeState.registrationReference;
    this.registrationReference = typeof routeReference === 'string' && routeReference.length >= 40 && routeReference.length <= 128
      ? routeReference
      : this.authService.getRegistrationReference() ?? '';
    this.email = typeof this.routeState?.email === 'string' ? this.routeState.email : '';
    this.secondsUntilResend = this.validCooldown(this.routeState?.resendCooldownSeconds);
    this.contextMissing = !this.registrationReference;
    if (this.contextMissing) this.message = 'Your registration session is missing or expired. Start registration again to request a new code.';
    if (!this.contextMissing && this.secondsUntilResend > 0) {
      this.countdownHandle = setInterval(() => {
        if (this.secondsUntilResend > 0) this.secondsUntilResend -= 1;
        if (this.secondsUntilResend <= 0 && this.countdownHandle) {
          clearInterval(this.countdownHandle);
          this.countdownHandle = undefined;
        }
      }, 1000);
    }
  }

  protected get maskedEmail(): string {
    const [localPart, domain] = this.email.split('@');
    if (!localPart || !domain) return this.email;
    const visible = localPart.length > 1 ? localPart[0] : '';
    return `${visible}${'•'.repeat(Math.max(3, Math.min(localPart.length - 1, 8)))}@${domain}`;
  }

  protected get formattedCountdown(): string {
    const minutes = Math.floor(this.secondsUntilResend / 60);
    const seconds = this.secondsUntilResend % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  protected updateOtp(value: string): void {
    this.otp.setValue(value.replace(/\D/g, '').slice(0, 6));
    this.otp.markAsDirty();
    this.message = '';
  }

  protected verify(): void {
    this.otp.markAsTouched();
    if (this.otp.invalid || this.contextMissing || this.verifying) return;

    this.message = '';
    this.verifying = true;
    this.authService.verifyRegistrationOtp({ registrationReference: this.registrationReference, otp: this.otp.value })
      .pipe(finalize(() => { this.verifying = false; }))
      .subscribe({
        next: (response) => {
          if (response?.verified !== true) {
            this.setError('The code could not be verified. Please try again.');
            return;
          }
          this.authService.clearRegistrationReference();
          this.messageKind = 'success';
          this.message = response.message || 'Your email is verified and your teacher account is ready. Redirecting to sign in…';
          this.redirectHandle = setTimeout(() => { void this.router.navigate(['/login'], { state: { registrationSuccess: true } }); }, 1400);
        },
        error: (error: unknown) => {
          const message = this.verificationError(error);
          if (AuthService.errorCode(error) === 'REGISTRATION_NOT_FOUND') this.invalidateRegistration(message);
          else this.setError(message);
        },
      });
  }

  protected resend(): void {
    if (this.contextMissing || this.resending || this.secondsUntilResend > 0) return;

    this.message = '';
    this.resending = true;
    this.authService.resendRegistrationOtp({ registrationReference: this.registrationReference })
      .pipe(finalize(() => { this.resending = false; }))
      .subscribe({
        next: (response) => {
          const cooldown = this.validCooldown(response?.resendCooldownSeconds);
          if (cooldown <= 0) {
            this.setError('The server did not confirm that a new code was sent. Please try again later.');
            return;
          }
          this.secondsUntilResend = cooldown;
          this.startCountdown();
          this.messageKind = 'success';
          this.message = 'A new verification code was sent to your email address.';
        },
        error: (error: unknown) => {
          const retryAfter = AuthService.retryAfterSeconds(error);
          if (retryAfter > 0) {
            this.secondsUntilResend = retryAfter;
            this.startCountdown();
          }
          const message = this.resendError(error);
          if (AuthService.errorCode(error) === 'REGISTRATION_NOT_FOUND') this.invalidateRegistration(message);
          else this.setError(message);
        },
      });
  }

  protected cancelAndRegister(): void {
    this.authService.clearRegistrationReference();
  }

  protected backToLogin(): void {
    this.authService.clearRegistrationReference();
  }

  private startCountdown(): void {
    if (this.countdownHandle) clearInterval(this.countdownHandle);
    this.countdownHandle = setInterval(() => {
      this.secondsUntilResend = Math.max(0, this.secondsUntilResend - 1);
      if (this.secondsUntilResend === 0 && this.countdownHandle) {
        clearInterval(this.countdownHandle);
        this.countdownHandle = undefined;
      }
    }, 1000);
  }

  private validCooldown(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(Math.floor(value), 3600)) : 0;
  }

  private setError(message: string): void {
    this.messageKind = 'error';
    this.message = message;
  }

  private invalidateRegistration(message: string): void {
    this.authService.clearRegistrationReference();
    this.contextMissing = true;
    this.setError(message);
  }

  private verificationError(error: unknown): string {
    switch (AuthService.errorCode(error)) {
      case 'OTP_INVALID': return 'That code is not correct. Check the email and try again.';
      case 'OTP_EXPIRED': return 'That code has expired. Request a new code to continue.';
      case 'OTP_ATTEMPTS_EXCEEDED': return 'The maximum number of attempts was reached. Request a new code to continue.';
      case 'REGISTRATION_NOT_FOUND': return 'This registration is no longer available. Start registration again.';
      default: return AuthService.errorMessage(error, 'We could not verify this code. Please try again.');
    }
  }

  private resendError(error: unknown): string {
    switch (AuthService.errorCode(error)) {
      case 'OTP_COOLDOWN': return 'Please wait until the resend timer ends before requesting another code.';
      case 'OTP_RESEND_LIMIT': return 'You have reached the code resend limit. Please try again later.';
      case 'REGISTRATION_NOT_FOUND': return 'This registration is no longer available. Start registration again.';
      case 'EMAIL_DELIVERY_FAILED': return 'We could not deliver a new code. Please try again later.';
      default: return AuthService.errorMessage(error, 'We could not resend the code. Please try again later.');
    }
  }

  ngOnDestroy(): void {
    if (this.countdownHandle) clearInterval(this.countdownHandle);
    if (this.redirectHandle) clearTimeout(this.redirectHandle);
  }
}

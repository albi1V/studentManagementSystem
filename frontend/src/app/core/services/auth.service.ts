import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthenticatedUser, LoginCredentials, LoginResponse, OtpRegistrationResponse, OtpVerificationResponse, ResendOtpRequest, ResendOtpResponse, TeacherRegistration, VerifyOtpRequest } from '../../shared/models/auth.models';

/** sessionStorage is JavaScript-accessible and does not protect against XSS. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly baseUrl = environment.apiUrl.replace(/\/$/, '') + '/api/auth';
  private readonly registrationReferenceKey = 'student-management.pending-registration-reference';
  private readonly accessTokenKey = 'student-management.access-token';
  private readonly authUserKey = 'student-management.auth-user';
  private readonly authExpiresAtKey = 'student-management.auth-expires-at';

  saveRegistrationReference(reference: string): void {
    if (!isPlatformBrowser(this.platformId) || reference.length < 40 || reference.length > 128) return;
    try { sessionStorage.setItem(this.registrationReferenceKey, reference); } catch { /* router state can still serve the current page */ }
  }
  getRegistrationReference(): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    try {
      const reference = sessionStorage.getItem(this.registrationReferenceKey);
      return reference && reference.length >= 40 && reference.length <= 128 ? reference : null;
    } catch { return null; }
  }
  clearRegistrationReference(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try { sessionStorage.removeItem(this.registrationReferenceKey); } catch { /* storage may be blocked */ }
  }
  login(credentials: LoginCredentials): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(this.baseUrl + '/login', credentials).pipe(tap((response) => this.storeAuthSession(response)));
  }
  getAccessToken(): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    try {
      const token = sessionStorage.getItem(this.accessTokenKey);
      const expiry = sessionStorage.getItem(this.authExpiresAtKey);
      if (!token || !expiry || !Number.isFinite(Date.parse(expiry)) || Date.parse(expiry) <= Date.now()) {
        this.clearAuthSession();
        return null;
      }
      return token;
    } catch { return null; }
  }
  isAuthenticated(): boolean { return this.getAccessToken() !== null; }
  get currentUser(): AuthenticatedUser | null {
    if (!this.isAuthenticated() || !isPlatformBrowser(this.platformId)) return null;
    try {
      const value = sessionStorage.getItem(this.authUserKey);
      if (!value) return null;
      const user = JSON.parse(value) as Partial<AuthenticatedUser>;
      if (typeof user.id !== 'string' || typeof user.email !== 'string' || typeof user.fullName !== 'string' || typeof user.role !== 'string') return null;
      return { id: user.id, email: user.email, fullName: user.fullName, role: user.role };
    } catch { return null; }
  }
  loadCurrentUser(): Observable<AuthenticatedUser> {
    return this.http.get<AuthenticatedUser>(this.baseUrl + '/me').pipe(tap((user) => this.storeCurrentUser(user)));
  }
  private storeCurrentUser(user: AuthenticatedUser): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try { sessionStorage.setItem(this.authUserKey, JSON.stringify(user)); } catch { /* profile can still be shown for this page */ }
  }
  logout(): void { this.clearAuthSession(); }
  clearAuthSession(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      sessionStorage.removeItem(this.accessTokenKey);
      sessionStorage.removeItem(this.authUserKey);
      sessionStorage.removeItem(this.authExpiresAtKey);
    } catch { /* storage may be blocked */ }
  }
  private storeAuthSession(response: LoginResponse): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!response?.accessToken || !response.expiresAt || !response.user) throw new Error('The sign-in response was incomplete. Please try again.');
    try {
      sessionStorage.setItem(this.accessTokenKey, response.accessToken);
      sessionStorage.setItem(this.authUserKey, JSON.stringify(response.user));
      sessionStorage.setItem(this.authExpiresAtKey, response.expiresAt);
    } catch {
      this.clearAuthSession();
      throw new Error('This browser could not save your sign-in session. Enable session storage and try again.');
    }
  }
  requestRegistrationOtp(request: TeacherRegistration): Observable<OtpRegistrationResponse> {
    return this.http.post<OtpRegistrationResponse>(this.baseUrl + '/register', request);
  }
  verifyRegistrationOtp(request: VerifyOtpRequest): Observable<OtpVerificationResponse> {
    return this.http.post<OtpVerificationResponse>(this.baseUrl + '/verify-otp', request);
  }
  resendRegistrationOtp(request: ResendOtpRequest): Observable<ResendOtpResponse> {
    return this.http.post<ResendOtpResponse>(this.baseUrl + '/resend-otp', request);
  }
  static errorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const responseMessage = error.error?.message ?? error.error?.title;
      if (typeof responseMessage === 'string' && responseMessage.trim()) return responseMessage;
      if (error.status === 0) return 'Could not reach the server. Check your connection and try again.';
      if (error.status === 429) return 'Too many attempts. Please wait a moment and try again.';
    }
    if (error instanceof Error && error.message) return error.message;
    return fallback;
  }
  static errorCode(error: unknown): string | null {
    return error instanceof HttpErrorResponse && typeof error.error?.code === 'string' ? error.error.code : null;
  }
  static retryAfterSeconds(error: unknown): number {
    if (!(error instanceof HttpErrorResponse)) return 0;
    const bodyValue = error.error?.resendCooldownSeconds;
    const headerValue = Number(error.headers.get('Retry-After'));
    const seconds = typeof bodyValue === 'number' && Number.isFinite(bodyValue) ? bodyValue : headerValue;
    return Number.isFinite(seconds) ? Math.max(0, Math.min(Math.floor(seconds), 3600)) : 0;
  }
}
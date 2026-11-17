import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const apiRoot = environment.apiUrl.replace(/\/$/, '') + '/api/';
  const isApiRequest = environment.apiUrl ? request.url.startsWith(apiRoot) : request.url.startsWith('/api/');
  const path = request.url.split(/[?#]/, 1)[0].replace(/\/+$/, '');
  const isPublicAuthRequest = /\/api\/auth\/(login|register|verify-otp|resend-otp)$/.test(path);
  const token = isApiRequest && !isPublicAuthRequest ? auth.getAccessToken() : null;
  const outgoing = token ? request.clone({ setHeaders: { Authorization: 'Bearer ' + token } }) : request;
  return next(outgoing).pipe(catchError((error: unknown) => {
    if (error instanceof HttpErrorResponse && error.status === 401 && token) {
      auth.logout();
      const returnUrl = router.url;
      void router.navigate(['/login'], { queryParams: returnUrl.startsWith('/login') ? {} : { returnUrl } });
    }
    return throwError(() => error);
  }));
};
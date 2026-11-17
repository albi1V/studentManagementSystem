import { Routes } from '@angular/router';
import { loginRedirectGuard } from '../../core/auth/auth.guard';

export const AUTH_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'register', loadComponent: () => import('./pages/register/register.component').then(({ RegisterComponent }) => RegisterComponent) },
  { path: 'verify-otp', loadComponent: () => import('./pages/verify-otp/verify-otp.component').then(({ VerifyOtpComponent }) => VerifyOtpComponent) },
  { path: 'login', canActivate: [loginRedirectGuard], loadComponent: () => import('./pages/login/login.component').then(({ LoginComponent }) => LoginComponent) },
];
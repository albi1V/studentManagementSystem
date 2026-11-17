import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: '', loadChildren: () => import('./features/auth/auth.routes').then(({ AUTH_ROUTES }) => AUTH_ROUTES) },
  { path: 'students', canActivate: [authGuard], loadChildren: () => import('./features/students/students.routes').then(({ STUDENT_ROUTES }) => STUDENT_ROUTES) },
  { path: 'class-scheduling', canActivate: [authGuard], loadChildren: () => import('./features/class-scheduling/class-scheduling.routes').then(({ CLASS_SCHEDULING_ROUTES }) => CLASS_SCHEDULING_ROUTES) },
  { path: 'dashboard', canActivate: [authGuard], loadChildren: () => import('./features/dashboard/dashboard.routes').then(({ DASHBOARD_ROUTES }) => DASHBOARD_ROUTES) },
  { path: '**', redirectTo: 'login' },
];

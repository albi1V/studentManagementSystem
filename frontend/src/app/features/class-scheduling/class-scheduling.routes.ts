import { Routes } from '@angular/router';

export const CLASS_SCHEDULING_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./pages/class-scheduling/class-scheduling.component').then(({ ClassSchedulingComponent }) => ClassSchedulingComponent) },
];

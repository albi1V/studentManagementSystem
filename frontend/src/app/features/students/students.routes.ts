import { Routes } from '@angular/router';
export const STUDENT_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./pages/students-list/students-list.component').then(({ StudentsListComponent }) => StudentsListComponent) },
  { path: 'new', loadComponent: () => import('./pages/student-editor/student-editor.component').then(({ StudentEditorComponent }) => StudentEditorComponent) },
  { path: ':id/edit', loadComponent: () => import('./pages/student-editor/student-editor.component').then(({ StudentEditorComponent }) => StudentEditorComponent) },
  { path: ':id', loadComponent: () => import('./pages/student-details/student-details.component').then(({ StudentDetailsComponent }) => StudentDetailsComponent) },
];
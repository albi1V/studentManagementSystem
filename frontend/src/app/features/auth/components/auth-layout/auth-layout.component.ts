import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({ selector: 'app-auth-layout', standalone: true, imports: [RouterLink], templateUrl: './auth-layout.component.html', styleUrl: './auth-layout.component.css' })
export class AuthLayoutComponent {
  protected readonly currentYear = new Date().getFullYear();
  @Input() brandHeading = 'Manage your classes. Empower your students.';
  @Input() brandDescription = 'Everything you need to organize students, plan classes, and stay on top of your teaching day, all in one place.';
  @Input() brandFeatures = ['Student management', 'Smart class scheduling', 'Attendance tracking'];
  @Input() alignContentTop = false;
}

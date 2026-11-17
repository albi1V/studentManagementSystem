import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnInit, inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { DashboardIconComponent } from '../../../../shared/components/dashboard-icon/dashboard-icon.component';
import { ClassSchedule, ScheduleInput, SchedulePreview, ScheduleStudent } from '../../models/class-schedule.model';
import { ClassSchedulesService } from '../../services/class-schedules.service';

@Component({ selector: 'app-class-scheduling', standalone: true, imports: [FormsModule, RouterLink, RouterLinkActive, DashboardIconComponent], templateUrl: './class-scheduling.component.html', styleUrls: ['./class-scheduling.component.css', './class-scheduling.embed.css'], changeDetection: ChangeDetectionStrategy.OnPush })
export class ClassSchedulingComponent implements OnInit {
  @Input() embedded = false;
  @Input() showForm = true;
  private readonly api = inject(ClassSchedulesService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected mobileMenuOpen = false;
  protected students: ScheduleStudent[] = [];
  protected classes: ClassSchedule[] = [];
  protected studentId = '';
  protected teacherDate = '';
  protected teacherTime = '09:00';
  protected durationMinutes = 60;
  protected description = '';
  protected preview: SchedulePreview | null = null;
  protected studentState: 'loading' | 'loaded' | 'error' = 'loading';
  protected classesState: 'loading' | 'loaded' | 'error' = 'loading';
  protected loadingPreview = false;
  protected submitting = false;
  protected success = '';
  protected error = '';
  private previewRequest = 0;
  protected get teacherName(): string { return this.auth.currentUser?.fullName ?? 'Teacher'; }
  protected get initials(): string { return this.teacherName.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase() || 'T'; }
  protected get selectedStudent(): ScheduleStudent | undefined { return this.students.find((x) => x.id === this.studentId); }
  protected get todayInIst(): string { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
  protected get canSubmit(): boolean { return !!this.selectedStudent && !!this.teacherDate && !!this.teacherTime && !!this.preview && Date.parse(this.preview.startDateTimeUtc) > Date.now() && !this.loadingPreview && !this.submitting; }
  ngOnInit(): void { if (this.showForm) this.loadStudents(); this.loadClasses(); }
  protected loadStudents(): void {
    this.studentState = 'loading';
    this.api.students().subscribe({
      next: (items) => { this.students = items; this.studentState = 'loaded'; this.changeDetector.markForCheck(); },
      error: () => { this.studentState = 'error'; this.changeDetector.markForCheck(); },
    });
  }
  protected loadClasses(): void {
    this.classesState = 'loading';
    this.api.list().subscribe({
      next: (items) => { this.classes = items; this.classesState = 'loaded'; this.changeDetector.markForCheck(); },
      error: () => { this.classesState = 'error'; this.changeDetector.markForCheck(); },
    });
  }
  protected changed(): void {
    this.success = ''; this.error = ''; this.preview = null;
    const requestId = ++this.previewRequest;
    if (!this.studentId || !this.teacherDate || !this.teacherTime) { this.loadingPreview = false; return; }
    this.loadingPreview = true;
    this.api.preview(this.input()).subscribe({
      next: (value) => { if (requestId === this.previewRequest) { this.preview = value; this.loadingPreview = false; this.changeDetector.markForCheck(); } },
      error: (reason: unknown) => { if (requestId === this.previewRequest) { this.loadingPreview = false; this.error = ClassSchedulesService.errorMessage(reason); this.changeDetector.markForCheck(); } },
    });
  }
  protected schedule(form: NgForm): void {
    if (!this.canSubmit) return;
    this.submitting = true; this.error = ''; this.success = '';
    this.api.create(this.input()).subscribe({
      next: () => {
        this.resetForm();
        form.resetForm({ studentId: '', teacherDate: '', teacherTime: '09:00', durationMinutes: 60, description: '' });
        this.success = 'Class scheduled successfully!';
        this.loadClasses();
        this.changeDetector.markForCheck();
      },
      error: (reason: unknown) => { this.submitting = false; this.error = ClassSchedulesService.errorMessage(reason); this.changeDetector.markForCheck(); },
    });
  }
  private resetForm(): void {
    this.studentId = '';
    this.teacherDate = '';
    this.teacherTime = '09:00';
    this.durationMinutes = 60;
    this.description = '';
    this.preview = null;
    this.loadingPreview = false;
    this.error = '';
    this.submitting = false;
    this.previewRequest++;
  }
  protected format(value: string, zone: string, options: Intl.DateTimeFormatOptions): string { return new Intl.DateTimeFormat('en-IN', { ...options, timeZone: zone }).format(new Date(value)); }
  protected toggleMobileMenu(): void { this.mobileMenuOpen = !this.mobileMenuOpen; }
  protected closeMobileMenu(): void { this.mobileMenuOpen = false; }
  protected logout(): void { this.auth.logout(); void this.router.navigate(['/login']); }
  private input(): ScheduleInput { return { studentId: this.studentId, teacherDate: this.teacherDate, teacherTime: this.teacherTime, durationMinutes: Number(this.durationMinutes), description: this.description.trim() || null }; }
}

import { ChangeDetectorRef, Component, ElementRef, HostListener, OnInit, ViewChild, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { EMPTY, Observable, Subscription, catchError, finalize, forkJoin, map, of, switchMap } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { DashboardIconComponent } from '../../../../shared/components/dashboard-icon/dashboard-icon.component';
import { StudentsService } from '../../../students/services/students.service';
import { ClassSchedulingComponent } from '../../../class-scheduling/pages/class-scheduling/class-scheduling.component';
import { Student } from '../../../students/models/student.model';

@Component({
  selector: 'app-dashboard-home',
  standalone: true,
  imports: [ClassSchedulingComponent, DashboardIconComponent, FormsModule, RouterLink, RouterLinkActive],
  templateUrl: './dashboard-home.component.html',
  styleUrl: './dashboard-home.component.css',
})
export class DashboardHomeComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly students = inject(StudentsService);
  private readonly changeDetector = inject(ChangeDetectorRef);


  protected mobileMenuOpen = false;
  protected studentCount: number | null = null;
  protected studentCountState: 'loading' | 'loaded' | 'error' = 'loading';
  protected converterOpen = false;
  protected converterStudents: Student[] = [];
  protected converterStudentId = '';
  protected converterState: 'loading' | 'loaded' | 'error' = 'loading';
  protected converterError = '';
  protected converterDate = this.todayInIst();
  protected converterTime = this.timeNowInIst();
  protected copyConfirmation = false;
  @ViewChild('converterDialog') private converterDialog?: ElementRef<HTMLElement>;
  @ViewChild('converterCard') private converterCard?: ElementRef<HTMLButtonElement>;
  @ViewChild('converterStudent') private converterStudent?: ElementRef<HTMLSelectElement>;
  private previousBodyOverflow = '';
  private copyTimer?: ReturnType<typeof setTimeout>;
  private converterLoadSubscription?: Subscription;
  private converterLoadRequestId = 0;

  protected get teacherName(): string {
    return this.auth.currentUser?.fullName ?? 'Teacher';
  }

  protected get initials(): string {
    return this.teacherName.split(/\s+/).filter(Boolean).slice(0, 2)
      .map((part) => part[0]).join('').toUpperCase() || 'T';
  }

  ngOnInit(): void {
    this.auth.loadCurrentUser().subscribe({ error: () => { /* the interceptor clears rejected sessions and redirects */ } });
    this.students.list('', 1, 1).subscribe({
      next: (result) => {
        this.studentCount = result.totalStudents;
        this.studentCountState = 'loaded';
        this.changeDetector.markForCheck();
      },
      error: () => { this.studentCountState = 'error'; this.changeDetector.markForCheck(); },
    });
  }

  protected toggleMobileMenu(): void { this.mobileMenuOpen = !this.mobileMenuOpen; }
  protected closeMobileMenu(): void { this.mobileMenuOpen = false; }

  protected logout(): void {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }

  protected get converterStudentRecord(): Student | undefined { return this.converterStudents.find((item) => item.id === this.converterStudentId); }

  protected get conversion(): { instant: Date; date: string; time: string; zone: string } | null {
    const student = this.converterStudentRecord;
    if (!this.converterOpen || !student || !this.converterDate || !this.converterTime || this.converterError) return null;
    try {
      if (!student.timeZoneId) throw new Error('This student has no saved timezone. Update their profile in My Students.');
      const instant = this.resolveWallTime(this.converterDate, this.converterTime, 'Asia/Kolkata');
      const fields = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: student.timeZoneId, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(instant).map((part) => [part.type, part.value]));
      const zone = new Intl.DateTimeFormat('en', { timeZone: student.timeZoneId, timeZoneName: 'short' }).formatToParts(instant).find((part) => part.type === 'timeZoneName')?.value ?? student.timeZoneId;
      return { instant, date: `${fields['day']}/${fields['month']}/${fields['year']}`, time: `${fields['hour']}:${fields['minute']}`, zone };
    } catch (error) {
      this.converterError = error instanceof Error ? error.message : 'Could not convert this time. Check the student timezone.';
      return null;
    }
  }

  protected get formattedTeacherTime(): string {
    if (!this.converterDate || !this.converterTime) return '';
    return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).format(this.resolveWallTime(this.converterDate, this.converterTime, 'Asia/Kolkata')) + ' IST';
  }

  protected openConverter(): void {
    this.converterOpen = true; this.converterError = ''; this.copyConfirmation = false; this.converterStudents = []; this.converterStudentId = '';
    this.previousBodyOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    this.loadConverterStudents();
    setTimeout(() => this.converterStudent?.nativeElement.focus());
  }

  protected closeConverter(): void {
    this.converterLoadRequestId++;
    this.converterLoadSubscription?.unsubscribe();
    this.converterOpen = false; document.body.style.overflow = this.previousBodyOverflow;
    if (this.copyTimer) clearTimeout(this.copyTimer);
    setTimeout(() => this.converterCard?.nativeElement.focus());
  }

  @HostListener('document:keydown.escape')
  protected escapeConverter(): void { if (this.converterOpen) this.closeConverter(); }

  protected trapConverterFocus(event: KeyboardEvent): void {
    if (event.key !== 'Tab' || !this.converterDialog) return;
    const list = Array.from(this.converterDialog.nativeElement.querySelectorAll<HTMLElement>('button:not([disabled]),select:not([disabled]),input:not([disabled]),a[href]'));
    if (!list.length) return;
    if (event.shiftKey && document.activeElement === list[0]) { event.preventDefault(); list[list.length - 1].focus(); }
    else if (!event.shiftKey && document.activeElement === list[list.length - 1]) { event.preventDefault(); list[0].focus(); }
  }

  protected converterChanged(): void { this.converterError = ''; this.copyConfirmation = false; void this.conversion; }

  protected loadConverterStudents(): void {
    const requestId = ++this.converterLoadRequestId;
    this.converterLoadSubscription?.unsubscribe();
    this.converterState = 'loading'; this.converterError = '';
    this.converterLoadSubscription = this.students.list('', 1, 100, 'active').pipe(
      switchMap((response) => {
        const first = this.normalizeStudentResponse(response);
        const requests = Array.from({ length: Math.max(0, first.totalPages - 1) }, (_, index) =>
          this.students.list('', index + 2, first.pageSize, 'active').pipe(map((page) => this.normalizeStudentResponse(page).students)));
        const remaining: Observable<Student[][]> = requests.length ? forkJoin(requests) : of([]);
        return remaining.pipe(map((pages) => [...first.students, ...pages.flat()]));
      }),
      catchError((error: unknown) => {
        if (requestId === this.converterLoadRequestId) {
          this.converterError = StudentsService.errorMessage(error, 'Students could not be loaded. Please try again.');
          this.converterState = 'error';
          this.changeDetector.markForCheck();
        }
        return EMPTY;
      }),
      finalize(() => {
        if (requestId === this.converterLoadRequestId && this.converterState === 'loading') {
          this.converterState = 'loaded';
          this.changeDetector.markForCheck();
        }
      }),
    ).subscribe((students) => {
      if (requestId !== this.converterLoadRequestId) return;
      this.converterStudents = students;
      this.converterState = 'loaded';
      this.changeDetector.markForCheck();
    });
  }

  private normalizeStudentResponse(response: unknown): { students: Student[]; totalPages: number; pageSize: number } {
    let records: unknown[];
    let totalPages = 1;
    let pageSize = 100;
    if (Array.isArray(response)) {
      records = response;
    } else if (response && typeof response === 'object' && Array.isArray((response as { items?: unknown }).items)) {
      const payload = response as { items: unknown[]; totalPages?: unknown; totalCount?: unknown; pageSize?: unknown };
      records = payload.items;
      if (typeof payload.pageSize === 'number' && Number.isInteger(payload.pageSize) && payload.pageSize > 0) pageSize = payload.pageSize;
      if (typeof payload.totalPages === 'number' && Number.isInteger(payload.totalPages) && payload.totalPages > 0) {
        totalPages = payload.totalPages;
      } else if (typeof payload.totalCount === 'number' && Number.isFinite(payload.totalCount) && payload.totalCount > records.length) {
        totalPages = Math.ceil(payload.totalCount / pageSize);
      }
    } else {
      throw new Error('The students API returned an unrecognized response.');
    }

    const students = records.filter((value): value is Student => {
      if (!value || typeof value !== 'object') return false;
      const record = value as Partial<Student>;
      return typeof record.id === 'string' && typeof record.fullName === 'string';
    }).map((student) => ({
      ...student,
      status: typeof student.status === 'string' && student.status.toLowerCase() === 'inactive' ? 'Inactive' as const : 'Active' as const,
    }));
    return { students: students.filter((student) => student.status === 'Active'), totalPages, pageSize };
  }

  protected async copyConversion(): Promise<void> {
    const student = this.converterStudentRecord, converted = this.conversion;
    if (!student || !converted) return;
    const studentTime = new Intl.DateTimeFormat('en-IN', { timeZone: student.timeZoneId!, day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).format(converted.instant);
    const text = `Teacher time:\n${this.formattedTeacherTime}\n\nStudent:\n${student.fullName} – ${student.city || 'City not provided'}, ${student.country || 'Country not provided'}\n\nStudent local time:\n${studentTime} ${converted.zone}\n${student.timeZoneId}`;
    try { await navigator.clipboard.writeText(text); this.copyConfirmation = true; this.copyTimer = setTimeout(() => this.copyConfirmation = false, 2200); }
    catch { this.converterError = 'Clipboard access is unavailable. Please copy the result manually.'; }
  }

  private todayInIst(): string {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map((x) => [x.type, x.value]));
    return `${p['year']}-${p['month']}-${p['day']}`;
  }
  private timeNowInIst(): string {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map((x) => [x.type, x.value]));
    return `${p['hour']}:${p['minute']}`;
  }
  private resolveWallTime(date: string, time: string, zone: string): Date {
    const [year, month, day] = date.split('-').map(Number), [hour, minute] = time.split(':').map(Number);
    const nominal = Date.UTC(year, month - 1, day, hour, minute), offsets = new Set<number>();
    for (let delta = -36; delta <= 36; delta += 3) {
      const sample = new Date(nominal + delta * 3600000);
      const p = this.partsAt(sample, zone);
      offsets.add(Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - sample.getTime());
    }
    const candidates = [...offsets].map((offset) => new Date(nominal - offset)).filter((candidate) => {
      const p = this.partsAt(candidate, zone);
      return p.year === year && p.month === month && p.day === day && p.hour === hour && p.minute === minute && p.second === 0;
    });
    if (!candidates.length) throw new Error('That local time does not exist because the timezone changes its clocks at that moment. Choose another time.');
    if (candidates.length > 1) throw new Error('That local time occurs twice because of a daylight saving change. Choose a different time to avoid ambiguity.');
    return candidates[0];
  }
  private partsAt(date: Date, zone: string): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(date).map((x) => [x.type, x.value]));
    return { year: +p['year'], month: +p['month'], day: +p['day'], hour: +p['hour'], minute: +p['minute'], second: +p['second'] };
  }
}

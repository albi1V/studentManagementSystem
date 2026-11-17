import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, timeout } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ClassSchedule, ScheduleInput, SchedulePreview, ScheduleStudent } from '../models/class-schedule.model';

@Injectable({ providedIn: 'root' })
export class ClassSchedulesService {
  private readonly http = inject(HttpClient);
  private readonly url = environment.apiUrl.replace(/\/$/, '') + '/api/class-schedules';
  students(): Observable<ScheduleStudent[]> { return this.http.get<unknown>(this.url + '/students').pipe(timeout(15000), map((value) => this.requireArray<ScheduleStudent>(value, 'student'))); }
  list(): Observable<ClassSchedule[]> { return this.http.get<unknown>(this.url).pipe(timeout(15000), map((value) => this.requireArray<ClassSchedule>(value, 'class'))); }
  preview(input: ScheduleInput): Observable<SchedulePreview> { return this.http.post<SchedulePreview>(this.url + '/preview', input); }
  create(input: ScheduleInput): Observable<ClassSchedule> { return this.http.post<ClassSchedule>(this.url, input); }
  static errorMessage(error: unknown): string {
    if (error instanceof Error && error.name === 'TimeoutError') return 'The server took too long to respond. Check that the API and database are running, then try again.';
    if (error instanceof Error && error.message.startsWith('Unexpected class scheduling response')) return error.message;
    if (!(error instanceof HttpErrorResponse)) return 'Could not complete the request. Please try again.';
    const detail = error.error as { detail?: string; errors?: Record<string, string[]> } | null;
    if (error.status === 0) return 'Could not reach the server. Check your connection and try again.';
    if (error.status === 400) return detail?.errors ? Object.values(detail.errors).flat().join(' ') : 'Review the class details and try again.';
    if (error.status === 409) return detail?.detail ?? 'You already have another class scheduled during this time. Please select a different time.';
    if (error.status === 401) return 'Your session has expired. Sign in again to continue.';
    if (error.status === 403) return 'You do not have permission to schedule this class.';
    return detail?.detail ?? 'The request could not be completed right now. Please try again.';
  }
  private requireArray<T>(value: unknown, resource: string): T[] {
    if (!Array.isArray(value)) throw new Error(`Unexpected class scheduling response: expected a list of ${resource}s.`);
    return value as T[];
  }
}

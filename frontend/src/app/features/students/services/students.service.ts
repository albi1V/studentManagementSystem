import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Student, StudentListResponse, StudentOnboardingRequest, StudentRequest, StudentStatusFilter } from '../models/student.model';
@Injectable({ providedIn: 'root' })
export class StudentsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl.replace(/\/$/, '') + '/api/students';
  list(search = '', page = 1, pageSize = 10, status: StudentStatusFilter = 'all', country = '', gradeOrYear = '', teachingMode = ''): Observable<StudentListResponse> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (search.trim()) params = params.set('search', search.trim());
    if (status !== 'all') params = params.set('isActive', status === 'active');
    if (country) params = params.set('country', country);
    if (gradeOrYear) params = params.set('gradeOrYear', gradeOrYear);
    if (teachingMode) params = params.set('teachingMode', teachingMode);
    return this.http.get<StudentListResponse>(this.baseUrl, { params });
  }
  get(id: string): Observable<Student> { return this.http.get<Student>(this.baseUrl + '/' + encodeURIComponent(id)); }
  create(request: StudentOnboardingRequest): Observable<Student> { return this.http.post<Student>(this.baseUrl, request); }
  createOnboarded(request: StudentOnboardingRequest): Observable<Student> { return this.http.post<Student>(this.baseUrl, request); }
  update(id: string, request: StudentRequest): Observable<Student> { return this.http.put<Student>(this.baseUrl + '/' + encodeURIComponent(id), request); }
  updateStatus(id: string, isActive: boolean): Observable<Student> { return this.http.patch<Student>(this.baseUrl + '/' + encodeURIComponent(id) + '/status', { isActive }); }
  static errorMessage(error: unknown, fallback: string): string {
    if (!(error instanceof HttpErrorResponse)) return fallback;
    switch (error.status) {
      case 0: return 'Could not reach the server. Check your connection and try again.';
      case 400: { const errors = (error.error as { errors?: Record<string, string[]> } | null)?.errors; const messages = errors ? Object.values(errors).flat().filter(Boolean) : []; return messages.length ? messages.join(' ') : 'Some of the student details are invalid. Review the form and try again.'; }
      case 401: return 'Your session has expired. Sign in again to continue.';
      case 403: return 'You do not have permission to manage these students.';
      case 404: return 'This student could not be found.';
      case 409: return 'This change conflicts with the current student record.';
      case 500: return 'The request could not be completed right now. Please try again later.';
      default: return fallback;
    }
  }
}



import { By } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { ClassSchedulingComponent } from '../../../class-scheduling/pages/class-scheduling/class-scheduling.component';
import { ClassSchedulesService } from '../../../class-scheduling/services/class-schedules.service';
import { StudentsService } from '../../../students/services/students.service';
import { DashboardHomeComponent } from './dashboard-home.component';

describe('DashboardHomeComponent dashboard integrations', () => {
  it('loads converter students in zoneless mode and keeps embedded scheduling intact', async () => {
    let studentListRequests = 0;
    const activeStudents = [
      { id: 'student-1', fullName: 'Student Example', city: 'Melbourne', country: 'Australia', timeZoneId: 'Australia/Melbourne', status: 'active' },
      { id: 'student-2', fullName: 'Another Student', city: 'London', country: 'United Kingdom', timeZoneId: 'Europe/London', status: 'Active' },
      { id: 'student-3', fullName: 'Student Three', city: 'Sydney', country: 'Australia', timeZoneId: 'Australia/Sydney', status: 'Active' },
      { id: 'student-4', fullName: 'Student Four', city: 'Auckland', country: 'New Zealand', timeZoneId: 'Pacific/Auckland', status: 'Active' },
      { id: 'student-5', fullName: 'Student Five', city: 'New York', country: 'United States', timeZoneId: 'America/New_York', status: 'Active' },
      { id: 'student-6', fullName: 'Student Six', city: 'Mumbai', country: 'India', timeZoneId: 'Asia/Kolkata', status: 'Active' },
    ];
    const activeRequests: Subject<unknown>[] = [];
    const scheduleApi = {
      students: () => { studentListRequests++; return of([{ id: 'student-1', fullName: 'Student Example', city: 'Melbourne', country: 'Australia', timeZoneId: 'Australia/Melbourne' }]); },
      list: () => of([]),
    };
    await TestBed.configureTestingModule({
      imports: [DashboardHomeComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: AuthService, useValue: { currentUser: { fullName: 'Teacher Example' }, loadCurrentUser: () => of({}), logout: () => undefined } },
        { provide: StudentsService, useValue: { list: (_search = '', _page = 1, _pageSize = 10, status = 'all') => {
          if (status !== 'active') return of({ totalStudents: 2 });
          const request = new Subject<unknown>();
          activeRequests.push(request);
          return request.asObservable();
        } } },
        { provide: ClassSchedulesService, useValue: scheduleApi },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(DashboardHomeComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const embedded = fixture.debugElement.query(By.directive(ClassSchedulingComponent));
    expect(embedded).not.toBeNull();
    expect(embedded.componentInstance.embedded).toBe(true);
    expect(embedded.componentInstance.showForm).toBe(false);
    expect(embedded.nativeElement.querySelector('.schedule-form')).toBeNull();
    expect(embedded.nativeElement.querySelector('.schedule-panel:not(.upcoming-panel)')).toBeNull();
    expect(embedded.nativeElement.querySelector('.upcoming-panel')).not.toBeNull();
    expect(studentListRequests).toBe(0);

    const navigationCard = fixture.nativeElement.querySelector('.class-scheduling-card') as HTMLAnchorElement;
    expect(navigationCard.tagName).toBe('A');
    expect(navigationCard.getAttribute('href')).toBe('/class-scheduling');
    expect(navigationCard.textContent).toContain('Class Scheduling');
    expect(navigationCard.textContent).toContain('Schedule classes and manage your upcoming lessons.');

    const converterCard = fixture.nativeElement.querySelector('.timezone-card') as HTMLButtonElement;
    converterCard.click();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.converter-state').textContent).toContain('Loading your active students');
    const firstRequest = activeRequests.shift()!;
    firstRequest.next({ items: activeStudents, page: 1, pageSize: 100, totalCount: 6, totalStudents: 6, activeCount: 6, inactiveCount: 0, totalPages: 1 });
    firstRequest.complete();
    // Complete the active request after the click handler has returned to model an asynchronous HTTP response.
    await fixture.whenStable();
    const studentSelect = fixture.nativeElement.querySelector('#converter-student') as HTMLSelectElement;
    expect(studentSelect).not.toBeNull();
    expect(studentSelect.options.length).toBe(7);
    expect(studentSelect.options[1].textContent).toContain('Student Example');
    expect(studentSelect.options[1].textContent).toContain('Melbourne, Australia');
    expect(studentSelect.options[6].textContent).toContain('Mumbai, India');
    expect(fixture.nativeElement.querySelector('.converter-state')).toBeNull();
    studentSelect.value = 'student-1';
    studentSelect.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.converter-location').textContent).toContain('Melbourne, Australia');
    expect(fixture.nativeElement.querySelector('.result-zone-id').textContent).toContain('Australia/Melbourne');
    studentSelect.value = 'student-2';
    studentSelect.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.converter-location').textContent).toContain('London, United Kingdom');
    expect(fixture.nativeElement.querySelector('.result-zone-id').textContent).toContain('Europe/London');

    (fixture.nativeElement.querySelector('.timezone-close') as HTMLButtonElement).click();
    (fixture.nativeElement.querySelector('.timezone-card') as HTMLButtonElement).click();
    await fixture.whenStable();
    const metadataFreeRequest = activeRequests.shift()!;
    metadataFreeRequest.next({ items: activeStudents });
    metadataFreeRequest.complete();
    await fixture.whenStable();
    expect((fixture.nativeElement.querySelector('#converter-student') as HTMLSelectElement).options.length).toBe(7);

    (fixture.nativeElement.querySelector('.timezone-close') as HTMLButtonElement).click();
    (fixture.nativeElement.querySelector('.timezone-card') as HTMLButtonElement).click();
    await fixture.whenStable();
    const emptyRequest = activeRequests.shift()!;
    emptyRequest.next({ items: [] });
    emptyRequest.complete();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.converter-empty').textContent).toContain('No active students yet');

    (fixture.nativeElement.querySelector('.timezone-close') as HTMLButtonElement).click();
    (fixture.nativeElement.querySelector('.timezone-card') as HTMLButtonElement).click();
    await fixture.whenStable();
    activeRequests.shift()!.error(new Error('request failed'));
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.converter-notice.error').textContent).toContain('could not be loaded');
    expect(fixture.nativeElement.querySelector('.converter-notice button').textContent).toContain('Retry');
    (fixture.nativeElement.querySelector('.converter-notice button') as HTMLButtonElement).click();
    await fixture.whenStable();
    const retryRequest = activeRequests.shift()!;
    retryRequest.next({ items: activeStudents });
    retryRequest.complete();
    await fixture.whenStable();
    expect((fixture.nativeElement.querySelector('#converter-student') as HTMLSelectElement).options.length).toBe(7);
  });
});

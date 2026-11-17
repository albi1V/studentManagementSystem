import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { StudentsListComponent } from './students-list.component';
import { StudentsService } from '../../services/students.service';
import { StudentListResponse } from '../../models/student.model';

describe('StudentsListComponent', () => {
  const response: StudentListResponse = {
    items: [{
      id: 'e8bc2b24-3871-4786-b96b-2e3831af378', fullName: 'albin varghese', email: 'thewatalk2@gmail.com',
      phoneNumber: null, status: 'Active', notes: null, createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z',
      gradeOrYear: '8', country: 'Australia', timeZoneId: 'Australia/Melbourne', city: 'Melbourne', subjects: ['Mathematics'],
    }],
    page: 1, pageSize: 10, totalCount: 1, totalStudents: 1, activeCount: 1, inactiveCount: 0, totalPages: 1,
    countries: ['Australia'], gradesOrYears: ['8'], teachingModes: ['OneToOne'],
  };
  let api: { list: ReturnType<typeof vi.fn> };

  async function render(listResult = of(response)) {
    api = { list: vi.fn().mockReturnValue(listResult) };
    await TestBed.configureTestingModule({
      imports: [StudentsListComponent],
      providers: [provideRouter([]), { provide: StudentsService, useValue: api }],
    }).compileComponents();
    const fixture = TestBed.createComponent(StudentsListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('renders API items and server summary metadata, then clears loading', async () => {
    const fixture = await render();
    const html = fixture.nativeElement as HTMLElement;
    expect(html.textContent).toContain('albin varghese');
    expect(html.textContent).toContain('Australia');
    expect(html.textContent).toContain('Australia/Melbourne');
    expect(html.textContent).toContain('Active Students');
    expect(html.querySelector('.summary-grid')?.textContent).toContain('1');
    expect(html.textContent).not.toContain('Loading students');
    expect(html.textContent).toContain('Showing 1–1 of 1 students');
  });

  it('shows an API error instead of an empty-directory state and clears loading', async () => {
    const fixture = await render(throwError(() => new Error('request failed')));
    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('[role="alert"]')).toBeTruthy();
    expect(html.textContent).not.toContain('No students yet');
    expect(html.textContent).not.toContain('Loading students');
  });

  it('sends the selected status filter with the server-paginated list request', async () => {
    const fixture = await render();
    const status = (fixture.nativeElement as HTMLElement).querySelector('select')!;
    status.value = 'active';
    status.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(api.list).toHaveBeenLastCalledWith('', 1, 10, 'active', '', '', '');
  });
});

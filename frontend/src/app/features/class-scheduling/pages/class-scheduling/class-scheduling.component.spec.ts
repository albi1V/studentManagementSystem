import { HttpErrorResponse } from '@angular/common/http';
import { By } from '@angular/platform-browser';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgForm } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { ClassSchedule, SchedulePreview, ScheduleStudent } from '../../models/class-schedule.model';
import { ClassSchedulesService } from '../../services/class-schedules.service';
import { ClassSchedulingComponent } from './class-scheduling.component';

describe('ClassSchedulingComponent form reset', () => {
  const students: ScheduleStudent[] = [
    { id: 'student-1', fullName: 'Albin Varghese', country: 'Australia', city: 'Melbourne', timeZoneId: 'Australia/Melbourne' },
    { id: 'student-2', fullName: 'Rahul Saji', country: 'Australia', city: 'Melbourne', timeZoneId: 'Australia/Melbourne' },
  ];
  const preview: SchedulePreview = {
    startDateTimeUtc: '2099-05-12T03:30:00Z', endDateTimeUtc: '2099-05-12T04:30:00Z',
    teacherStart: '2099-05-12T09:00:00+05:30', teacherEnd: '2099-05-12T10:00:00+05:30',
    studentStart: '2099-05-12T13:30:00+09:30', studentEnd: '2099-05-12T14:30:00+09:30',
    teacherTimeZoneId: 'Asia/Kolkata', studentTimeZoneId: 'Australia/Melbourne', durationMinutes: 60,
  };
  let createResponse: Subject<ClassSchedule>;
  let fixture: ComponentFixture<ClassSchedulingComponent>;
  let listCalls: number;
  let savedClass: ClassSchedule;

  beforeEach(async () => {
    createResponse = new Subject<ClassSchedule>();
    listCalls = 0;
    savedClass = {
      ...preview, id: 'class-1', studentId: 'student-1', studentName: 'Albin Varghese',
      country: 'Australia', city: 'Melbourne', description: 'Algebra practice', status: 'Scheduled',
    };
    const api = {
      students: () => of(students),
      list: () => of(listCalls++ === 0 ? [] : [savedClass]),
      preview: () => of(preview),
      create: () => createResponse.asObservable(),
    };
    await TestBed.configureTestingModule({
      imports: [ClassSchedulingComponent],
      providers: [
        provideRouter([]),
        { provide: ClassSchedulesService, useValue: api },
        { provide: AuthService, useValue: { currentUser: { fullName: 'Teacher Example' }, logout: () => undefined } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ClassSchedulingComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  function fillForm(): NgForm {
    const component = fixture.componentInstance as unknown as {
      studentId: string; teacherDate: string; teacherTime: string; durationMinutes: number;
      description: string; preview: SchedulePreview; schedule: (form: NgForm) => void;
    };
    component.studentId = students[0].id;
    component.teacherDate = '2099-05-12';
    component.teacherTime = '09:00';
    component.durationMinutes = 60;
    component.description = 'Algebra practice';
    component.preview = preview;
    fixture.detectChanges();
    const form = fixture.debugElement.query(By.directive(NgForm)).injector.get(NgForm);
    form.controls['studentId'].setValue(students[0].id);
    form.controls['teacherDate'].setValue('2099-05-12');
    form.controls['teacherTime'].setValue('09:00');
    form.controls['durationMinutes'].setValue(60);
    form.controls['description'].setValue('Algebra practice');
    Object.values(form.controls).forEach((control) => { control.markAsDirty(); control.markAsTouched(); });
    return form;
  }

  it('shows both students and resets fields and form state only after a successful create, then refreshes classes', async () => {
    const select = fixture.nativeElement.querySelector('select[name="studentId"]') as HTMLSelectElement;
    expect(Array.from(select.options).map((option) => option.textContent?.trim())).toEqual([
      'Select a student', 'Albin Varghese · Melbourne, Australia', 'Rahul Saji · Melbourne, Australia',
    ]);
    const form = fillForm();
    const component = fixture.componentInstance as unknown as { schedule: (form: NgForm) => void; submitting: boolean };

    component.schedule(form);
    expect(component.submitting).toBe(true);
    expect(form.controls['description'].value).toBe('Algebra practice');
    expect(form.dirty).toBe(true);
    expect(fixture.nativeElement.textContent).not.toContain('Class scheduled successfully!');

    createResponse.next(savedClass);
    createResponse.complete();
    await fixture.whenStable();
    fixture.detectChanges();

    const state = fixture.componentInstance as unknown as {
      studentId: string; teacherDate: string; teacherTime: string; durationMinutes: number;
      description: string; preview: SchedulePreview | null; submitting: boolean;
    };
    expect(state.studentId).toBe('');
    expect(state.teacherDate).toBe('');
    expect(state.teacherTime).toBe('09:00');
    expect(state.durationMinutes).toBe(60);
    expect(state.description).toBe('');
    expect(state.preview).toBeNull();
    expect(state.submitting).toBe(false);
    expect(form.pristine).toBe(true);
    expect(form.untouched).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Class scheduled successfully!');
    expect(fixture.nativeElement.querySelector('.student-timezone')).toBeNull();
    expect(fixture.nativeElement.querySelector('.time-columns')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.class-row')).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('.class-row')?.textContent).toContain('Algebra practice');
  });

  it('embeds the same form and upcoming list without a second dashboard shell', () => {
    const component = fixture.componentInstance;
    expect(component.embedded).toBe(false);
    expect(fixture.nativeElement.querySelector('.sidebar')).not.toBeNull();

    fixture.componentRef.setInput('embedded', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.sidebar')).toBeNull();
    expect(fixture.nativeElement.querySelector('.topbar')).toBeNull();
    expect(fixture.nativeElement.querySelector('.schedule-form')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.upcoming-panel')).not.toBeNull();
  });

  it('preserves entered values when the create request fails', () => {
    const form = fillForm();
    const component = fixture.componentInstance as unknown as {
      studentId: string; teacherDate: string; teacherTime: string; durationMinutes: number;
      description: string; schedule: (form: NgForm) => void; submitting: boolean;
    };

    component.schedule(form);
    createResponse.error(new HttpErrorResponse({
      status: 409,
      error: { detail: 'You already have another class scheduled during this time. Please select a different time.' },
    }));
    fixture.detectChanges();

    expect(component.studentId).toBe(students[0].id);
    expect(component.teacherDate).toBe('2099-05-12');
    expect(component.teacherTime).toBe('09:00');
    expect(component.durationMinutes).toBe(60);
    expect(component.description).toBe('Algebra practice');
    expect(component.submitting).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('You already have another class scheduled during this time. Please select a different time.');
  });
});

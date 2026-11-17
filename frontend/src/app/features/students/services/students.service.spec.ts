import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { StudentsService } from './students.service';

describe('StudentsService directory query', () => {
  let service: StudentsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(StudentsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('trims search and sends pagination plus combined filters to the existing endpoint', () => {
    service.list('  albin  ', 2, 10, 'active', 'Australia', '8', 'OneToOne').subscribe();
    const request = http.expectOne(req => req.url === 'http://localhost:5173/api/students');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('search')).toBe('albin');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('pageSize')).toBe('10');
    expect(request.request.params.get('isActive')).toBe('true');
    expect(request.request.params.get('country')).toBe('Australia');
    expect(request.request.params.get('gradeOrYear')).toBe('8');
    expect(request.request.params.get('teachingMode')).toBe('OneToOne');
    request.flush({ items: [] });
  });
});

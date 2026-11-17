import { provideHttpClient } from '@angular/common/http';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';

describe('AuthService registration reference storage', () => {
  const storageKey = 'student-management.pending-registration-reference';

  afterEach(() => {
    sessionStorage.clear();
    TestBed.resetTestingModule();
  });

  it('stores only the opaque reference and makes it available after a service reload', () => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), AuthService, { provide: PLATFORM_ID, useValue: 'browser' }],
    });

    const reference = 'r'.repeat(43);
    TestBed.inject(AuthService).saveRegistrationReference(reference);

    expect(sessionStorage.length).toBe(1);
    expect(sessionStorage.key(0)).toBe(storageKey);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), AuthService, { provide: PLATFORM_ID, useValue: 'browser' }],
    });

    expect(TestBed.inject(AuthService).getRegistrationReference()).toBe(reference);
  });

  it('does not access browser storage during server rendering', () => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), AuthService, { provide: PLATFORM_ID, useValue: 'server' }],
    });

    const authService = TestBed.inject(AuthService);
    authService.saveRegistrationReference('r'.repeat(43));

    expect(authService.getRegistrationReference()).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });

  it('clears the reference when registration is completed or cancelled', () => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), AuthService, { provide: PLATFORM_ID, useValue: 'browser' }],
    });
    const authService = TestBed.inject(AuthService);
    authService.saveRegistrationReference('r'.repeat(43));

    authService.clearRegistrationReference();

    expect(authService.getRegistrationReference()).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });
});

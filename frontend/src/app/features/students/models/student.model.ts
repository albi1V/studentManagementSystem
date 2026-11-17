export type StudentStatus = 'Active' | 'Inactive';
export type StudentStatusFilter = 'all' | 'active' | 'inactive';
export interface Student { id: string; fullName: string; email: string | null; phoneNumber: string | null; status: StudentStatus; notes: string | null; createdAt: string; updatedAt: string; preferredName?: string | null; dateOfBirth?: string | null; gradeOrYear?: string | null; country?: string | null; stateOrProvince?: string | null; city?: string | null; timeZoneId?: string | null; preferredTeachingLanguage?: string | null; learningNotes?: string | null; guardians?: Guardian[] | null; subjects?: string[] | null; additionalLanguages?: string[] | null; teachingArrangement?: { teachingMode: 'OneToOne'|'Group'; defaultClassDurationMinutes: number; status: string } | null; availability?: Availability[] | null; }
export interface Guardian { fullName: string; relationship: string; email: string; phoneNumber: string | null; isPrimary: boolean; }
export interface Availability { dayOfWeek: string; startLocalTime: string; endLocalTime: string; timeZoneId: string; }
export interface StudentListResponse { items: Student[]; page: number; pageSize: number; totalCount: number; totalStudents: number; activeCount: number; inactiveCount: number; totalPages: number; countries: string[]; gradesOrYears: string[]; teachingModes: string[]; }
export interface StudentRequest { fullName: string; preferredName: string | null; dateOfBirth: string | null; gradeOrYear: string | null; email: string | null; phoneNumber: string | null; notes: string | null; guardian: {fullName: string;relationship:string;email:string;phoneNumber:string|null}|null; country: string|null; stateOrProvince:string|null; city:string|null; timeZoneId:string|null; preferredTeachingLanguage:string|null; learningNotes:string|null; subjects:string[]; additionalLanguages:string[]; teachingArrangement:{teachingMode:'OneToOne'|'Group';defaultClassDurationMinutes:number}|null; availability:Availability[]; }
export interface StudentOnboardingRequest {
  fullName: string; preferredName: string | null; dateOfBirth: string | null; gradeOrYear: string;
  email: string | null; phoneNumber: string | null; notes: string | null;
  guardian: { fullName: string; relationship: string; email: string; phoneNumber: string | null };
  country: string; stateOrProvince: string | null; city: string; timeZoneId: string;
  preferredTeachingLanguage: string; additionalLanguages: string[]; learningNotes: string | null; subjects: string[];
  teachingArrangement: { teachingMode: 'OneToOne' | 'Group'; defaultClassDurationMinutes: number };
  availability: { dayOfWeek: string; startLocalTime: string; endLocalTime: string }[];
}


export interface ScheduleStudent {
  id: string; fullName: string; country: string | null; city: string | null; timeZoneId: string;
}
export interface ScheduleInput {
  studentId: string; teacherDate: string; teacherTime: string; durationMinutes: number; description: string | null;
}
export interface SchedulePreview {
  startDateTimeUtc: string; endDateTimeUtc: string; teacherStart: string; teacherEnd: string;
  studentStart: string; studentEnd: string; teacherTimeZoneId: string; studentTimeZoneId: string; durationMinutes: number;
}
export interface ClassSchedule extends SchedulePreview {
  id: string; studentId: string; studentName: string; country: string | null; city: string | null; description: string | null; status: string;
}

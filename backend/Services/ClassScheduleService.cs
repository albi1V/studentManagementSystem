using System.ComponentModel.DataAnnotations;
using System.Data;
using Microsoft.EntityFrameworkCore;
using StudentManagement.Api.Data;
using StudentManagement.Api.DTOs;
using StudentManagement.Api.Entities;

namespace StudentManagement.Api.Services;

public sealed class ClassScheduleService(AuthDbContext database) : IClassScheduleService
{
    private const string TeacherTimeZone = "Asia/Kolkata";
    private static readonly int[] AllowedDurations = [30, 45, 60, 90];

    public async Task<IReadOnlyList<ScheduleStudentDto>> GetEligibleStudentsAsync(Guid teacherId, CancellationToken cancellationToken) =>
        await database.Students.AsNoTracking()
            .Where(x => x.TeacherId == teacherId && x.Status == StudentStatus.Active && x.TimeZoneId != null)
            .OrderBy(x => x.FullName)
            .Select(x => new ScheduleStudentDto(x.Id, x.FullName, x.Country, x.City, x.TimeZoneId!))
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<ClassScheduleDto>> GetSchedulesAsync(Guid teacherId, CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var items = await database.ClassSchedules.AsNoTracking()
            .Include(x => x.Student)
            .Where(x => x.TeacherId == teacherId && x.Status == ClassScheduleStatus.Scheduled && x.StartDateTimeUtc >= now)
            .OrderBy(x => x.StartDateTimeUtc)
            .ToListAsync(cancellationToken);
        return items.Select(ToDto).ToList();
    }

    public async Task<ClassScheduleDto?> GetScheduleAsync(Guid teacherId, Guid id, CancellationToken cancellationToken)
    {
        var item = await database.ClassSchedules.AsNoTracking().Include(x => x.Student)
            .SingleOrDefaultAsync(x => x.TeacherId == teacherId && x.Id == id, cancellationToken);
        return item is null ? null : ToDto(item);
    }

    public async Task<ClassSchedulePreviewDto> PreviewAsync(Guid teacherId, CreateClassScheduleDto request, CancellationToken cancellationToken)
    {
        ValidateInput(request);
        var student = await database.Students.AsNoTracking().SingleOrDefaultAsync(
            x => x.Id == request.StudentId && x.TeacherId == teacherId && x.Status == StudentStatus.Active,
            cancellationToken);
        if (student is null) throw new ValidationException("Select an active student belonging to your account.");
        if (string.IsNullOrWhiteSpace(student.TimeZoneId) || !TimeZoneInfo.TryConvertIanaIdToWindowsId(student.TimeZoneId, out _))
            throw new ValidationException("The student's saved IANA timezone is missing or invalid.");
        try
        {
            var zone = TimeZoneInfo.FindSystemTimeZoneById(student.TimeZoneId);
            var preview = Preview(request, zone);
            var conflict = await database.ClassSchedules.AsNoTracking().AnyAsync(x =>
                x.TeacherId == teacherId && x.Status != ClassScheduleStatus.Cancelled &&
                x.StartDateTimeUtc < preview.EndDateTimeUtc && preview.StartDateTimeUtc < x.EndDateTimeUtc,
                cancellationToken);
            if (conflict) throw new ScheduleConflictException("You already have another class scheduled during this time. Please select a different time.");
            return preview;
        }
        catch (TimeZoneNotFoundException) { throw new ValidationException("The student's saved timezone is invalid."); }
        catch (InvalidTimeZoneException) { throw new ValidationException("The student's saved timezone is invalid."); }
    }

    public async Task<ClassScheduleDto> CreateScheduleAsync(Guid teacherId, CreateClassScheduleDto request, CancellationToken cancellationToken)
    {
        ValidateInput(request);

        TimeZoneInfo teacherZone;
        try { teacherZone = TimeZoneInfo.FindSystemTimeZoneById(TeacherTimeZone); }
        catch (TimeZoneNotFoundException) { throw new InvalidOperationException("The server does not have the Asia/Kolkata timezone data installed."); }

        var localStart = request.TeacherDate.ToDateTime(request.TeacherTime, DateTimeKind.Unspecified);
        if (teacherZone.IsInvalidTime(localStart) || teacherZone.IsAmbiguousTime(localStart))
            throw new ValidationException("The selected teacher local time is invalid or ambiguous.");
        var startUtc = new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(localStart, teacherZone), TimeSpan.Zero);
        if (startUtc <= DateTimeOffset.UtcNow) throw new ValidationException("A class cannot be scheduled in the past.");
        var endUtc = startUtc.AddMinutes(request.DurationMinutes);

        await using var transaction = await database.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken);
        await database.Database.ExecuteSqlInterpolatedAsync(
            $"SELECT pg_advisory_xact_lock(hashtextextended({teacherId.ToString("N")}, 0))",
            cancellationToken);

        var student = await database.Students.SingleOrDefaultAsync(
            x => x.Id == request.StudentId && x.TeacherId == teacherId && x.Status == StudentStatus.Active,
            cancellationToken);
        if (student is null) throw new ValidationException("Select an active student belonging to your account.");
        if (string.IsNullOrWhiteSpace(student.TimeZoneId)) throw new ValidationException("This student does not have a saved timezone.");

        TimeZoneInfo studentZone;
        if (!TimeZoneInfo.TryConvertIanaIdToWindowsId(student.TimeZoneId, out _))
            throw new ValidationException("The student's saved timezone is not a valid IANA timezone. Update the student record before scheduling.");
        try { studentZone = TimeZoneInfo.FindSystemTimeZoneById(student.TimeZoneId); }
        catch (TimeZoneNotFoundException) { throw new ValidationException("The student's saved timezone is invalid. Update the student record before scheduling."); }
        catch (InvalidTimeZoneException) { throw new ValidationException("The student's saved timezone is invalid. Update the student record before scheduling."); }

        var studentConflict = await database.ClassSchedules.AnyAsync(x =>
            x.StudentId == student.Id && x.Status != ClassScheduleStatus.Cancelled &&
            x.StartDateTimeUtc < endUtc && startUtc < x.EndDateTimeUtc, cancellationToken);
        if (studentConflict) throw new ScheduleConflictException("This student already has a class scheduled during that time.");

        var teacherConflict = await database.ClassSchedules.AnyAsync(x =>
            x.TeacherId == teacherId && x.Status != ClassScheduleStatus.Cancelled &&
            x.StartDateTimeUtc < endUtc && startUtc < x.EndDateTimeUtc, cancellationToken);
        if (teacherConflict)
            throw new ScheduleConflictException("You already have another class scheduled during this time. Please select a different time.");

        var now = DateTimeOffset.UtcNow;
        var schedule = new ClassSchedule
        {
            Id = Guid.NewGuid(), TeacherId = teacherId, StudentId = student.Id,
            StartDateTimeUtc = startUtc, EndDateTimeUtc = endUtc,
            TeacherTimeZoneId = TeacherTimeZone, StudentTimeZoneId = student.TimeZoneId,
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            Status = ClassScheduleStatus.Scheduled, CreatedAt = now, UpdatedAt = now, Student = student,
        };
        database.ClassSchedules.Add(schedule);
        await database.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return ToDto(schedule);
    }

    private static void ValidateInput(CreateClassScheduleDto request)
    {
        if (request.StudentId == Guid.Empty) throw new ValidationException("Select a student.");
        if (!AllowedDurations.Contains(request.DurationMinutes)) throw new ValidationException("Duration must be 30, 45, 60, or 90 minutes.");
        if (request.TeacherDate == default) throw new ValidationException("Select a valid class date.");
    }

    private static ClassSchedulePreviewDto Preview(CreateClassScheduleDto request, TimeZoneInfo studentZone)
    {
        var teacherZone = TimeZoneInfo.FindSystemTimeZoneById(TeacherTimeZone);
        var localStart = request.TeacherDate.ToDateTime(request.TeacherTime, DateTimeKind.Unspecified);
        if (teacherZone.IsInvalidTime(localStart) || teacherZone.IsAmbiguousTime(localStart))
            throw new ValidationException("The selected teacher local time is invalid or ambiguous.");
        var start = new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(localStart, teacherZone), TimeSpan.Zero);
        var end = start.AddMinutes(request.DurationMinutes);
        return new ClassSchedulePreviewDto(start, end,
            TimeZoneInfo.ConvertTime(start, teacherZone), TimeZoneInfo.ConvertTime(end, teacherZone),
            TimeZoneInfo.ConvertTime(start, studentZone), TimeZoneInfo.ConvertTime(end, studentZone),
            TeacherTimeZone, studentZone.Id, request.DurationMinutes);
    }

    private static ClassScheduleDto ToDto(ClassSchedule x)
    {
        var teacherZone = TimeZoneInfo.FindSystemTimeZoneById(x.TeacherTimeZoneId);
        var studentZone = TimeZoneInfo.FindSystemTimeZoneById(x.StudentTimeZoneId);
        return new ClassScheduleDto(x.Id, x.StudentId, x.Student.FullName, x.Student.Country, x.Student.City,
            x.StartDateTimeUtc, x.EndDateTimeUtc,
            TimeZoneInfo.ConvertTime(x.StartDateTimeUtc, teacherZone), TimeZoneInfo.ConvertTime(x.EndDateTimeUtc, teacherZone),
            TimeZoneInfo.ConvertTime(x.StartDateTimeUtc, studentZone), TimeZoneInfo.ConvertTime(x.EndDateTimeUtc, studentZone),
            x.TeacherTimeZoneId, x.StudentTimeZoneId, (int)(x.EndDateTimeUtc - x.StartDateTimeUtc).TotalMinutes,
            x.Description, x.Status.ToString());
    }
}

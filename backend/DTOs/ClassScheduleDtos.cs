using System.ComponentModel.DataAnnotations;

namespace StudentManagement.Api.DTOs;

public sealed class CreateClassScheduleDto
{
    [Required] public Guid StudentId { get; init; }
    [Required] public DateOnly TeacherDate { get; init; }
    [Required] public TimeOnly TeacherTime { get; init; }
    [Required] public int DurationMinutes { get; init; }
    [StringLength(500)] public string? Description { get; init; }
}

public sealed record ScheduleStudentDto(Guid Id, string FullName, string? Country, string? City, string TimeZoneId);

public sealed record ClassSchedulePreviewDto(
    DateTimeOffset StartDateTimeUtc, DateTimeOffset EndDateTimeUtc,
    DateTimeOffset TeacherStart, DateTimeOffset TeacherEnd,
    DateTimeOffset StudentStart, DateTimeOffset StudentEnd,
    string TeacherTimeZoneId, string StudentTimeZoneId, int DurationMinutes);

public sealed record ClassScheduleDto(
    Guid Id, Guid StudentId, string StudentName, string? Country, string? City,
    DateTimeOffset StartDateTimeUtc, DateTimeOffset EndDateTimeUtc,
    DateTimeOffset TeacherStart, DateTimeOffset TeacherEnd,
    DateTimeOffset StudentStart, DateTimeOffset StudentEnd,
    string TeacherTimeZoneId, string StudentTimeZoneId, int DurationMinutes,
    string? Description, string Status);

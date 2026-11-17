namespace StudentManagement.Api.Entities;

public enum ClassScheduleStatus
{
    Scheduled = 1,
    Cancelled = 2,
    Completed = 3,
}

public sealed class ClassSchedule
{
    public Guid Id { get; set; }
    public Guid TeacherId { get; set; }
    public Guid StudentId { get; set; }
    public DateTimeOffset StartDateTimeUtc { get; set; }
    public DateTimeOffset EndDateTimeUtc { get; set; }
    public required string TeacherTimeZoneId { get; set; }
    public required string StudentTimeZoneId { get; set; }
    public string? Description { get; set; }
    public ClassScheduleStatus Status { get; set; } = ClassScheduleStatus.Scheduled;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public required Student Student { get; set; }
}

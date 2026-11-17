namespace StudentManagement.Api.Entities;

public enum TeachingMode { OneToOne = 1, Group = 2 }
public enum EnrollmentStatus { Active = 1, Inactive = 2 }

public sealed class StudentEnrollment
{
    public Guid Id { get; set; }
    public Guid StudentId { get; set; }
    public TeachingMode TeachingMode { get; set; }
    public int DefaultClassDurationMinutes { get; set; }
    public EnrollmentStatus Status { get; set; } = EnrollmentStatus.Active;
    public DateTimeOffset CreatedAt { get; set; }
    public Student Student { get; set; } = null!;
    public ICollection<StudentAvailability> Availability { get; set; } = new List<StudentAvailability>();
}

public sealed class StudentAvailability
{
    public Guid Id { get; set; }
    public Guid StudentEnrollmentId { get; set; }
    public DayOfWeek DayOfWeek { get; set; }
    public TimeOnly StartLocalTime { get; set; }
    public TimeOnly EndLocalTime { get; set; }
    public required string TimeZoneId { get; set; }
    public StudentEnrollment Enrollment { get; set; } = null!;
}

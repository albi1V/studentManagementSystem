namespace StudentManagement.Api.Entities;

public enum StudentStatus
{
    Active = 1,
    Inactive = 2,
}

public sealed class Student
{
    public Guid Id { get; set; }
    public Guid TeacherId { get; set; }
    public required string FullName { get; set; }
    public string? PreferredName { get; set; }
    public DateOnly? DateOfBirth { get; set; }
    public string? GradeOrYear { get; set; }
    public string? Email { get; set; }
    public string? PhoneNumber { get; set; }
    public string? Country { get; set; }
    public string? StateOrProvince { get; set; }
    public string? City { get; set; }
    public string? TimeZoneId { get; set; }
    public string? PreferredTeachingLanguage { get; set; }
    public StudentStatus Status { get; set; } = StudentStatus.Active;
    public string? Notes { get; set; }
    public string? LearningNotes { get; set; }
    public ICollection<StudentGuardian> Guardians { get; set; } = new List<StudentGuardian>();
    public ICollection<StudentSubject> Subjects { get; set; } = new List<StudentSubject>();
    public ICollection<StudentLanguage> AdditionalLanguages { get; set; } = new List<StudentLanguage>();
    public ICollection<StudentEnrollment> Enrollments { get; set; } = new List<StudentEnrollment>();
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

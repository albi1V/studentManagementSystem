using System.ComponentModel.DataAnnotations;
using StudentManagement.Api.Entities;

namespace StudentManagement.Api.DTOs;

public sealed class CreateStudentDto
{
    [Required, StringLength(100, MinimumLength = 2)]
    public required string FullName { get; init; }

    [StringLength(100)] public string? PreferredName { get; init; }
    public DateOnly? DateOfBirth { get; init; }
    [Required, StringLength(100)] public required string GradeOrYear { get; init; }

    [EmailAddress, StringLength(254)]
    public string? Email { get; init; }

    [StringLength(30)]
    public string? PhoneNumber { get; init; }

    [StringLength(2000)]
    public string? Notes { get; init; }

    [Required] public required GuardianInputDto Guardian { get; init; }
    [Required, StringLength(100)] public required string Country { get; init; }
    [StringLength(100)] public string? StateOrProvince { get; init; }
    [Required, StringLength(100)] public required string City { get; init; }
    [Required, StringLength(100)] public required string TimeZoneId { get; init; }
    [Required, StringLength(100)] public required string PreferredTeachingLanguage { get; init; }
    [StringLength(2000)] public string? LearningNotes { get; init; }
    [Required, MinLength(1), MaxLength(30)] public required IReadOnlyList<string> Subjects { get; init; }
    [MaxLength(20)] public IReadOnlyList<string> AdditionalLanguages { get; init; } = [];
    [Required] public required TeachingArrangementInputDto TeachingArrangement { get; init; }
    [MaxLength(28)] public IReadOnlyList<StudentAvailabilityInputDto> Availability { get; init; } = [];
}

public sealed class GuardianInputDto
{
    [Required, StringLength(100, MinimumLength = 2)] public required string FullName { get; init; }
    [Required] public required string Relationship { get; init; }
    [Required, EmailAddress, StringLength(254)] public required string Email { get; init; }
    [StringLength(30)] public string? PhoneNumber { get; init; }
}

public sealed class TeachingArrangementInputDto
{
    [Required] public required string TeachingMode { get; init; }
    [Range(30, 90)] public int DefaultClassDurationMinutes { get; init; } = 60;
}

public sealed class StudentAvailabilityInputDto
{
    [Required] public required string DayOfWeek { get; init; }
    public required TimeOnly StartLocalTime { get; init; }
    public required TimeOnly EndLocalTime { get; init; }
}

public sealed class UpdateStudentDto
{
    [Required, StringLength(100, MinimumLength = 2)]
    public required string FullName { get; init; }

    [StringLength(100)] public string? PreferredName { get; init; }
    public DateOnly? DateOfBirth { get; init; }
    [StringLength(100)] public string? GradeOrYear { get; init; }

    [EmailAddress, StringLength(254)]
    public string? Email { get; init; }

    [StringLength(30)]
    public string? PhoneNumber { get; init; }

    [StringLength(2000)]
    public string? Notes { get; init; }

    public GuardianInputDto? Guardian { get; init; }
    [StringLength(100)] public string? Country { get; init; }
    [StringLength(100)] public string? StateOrProvince { get; init; }
    [StringLength(100)] public string? City { get; init; }
    [StringLength(100)] public string? TimeZoneId { get; init; }
    [StringLength(100)] public string? PreferredTeachingLanguage { get; init; }
    [StringLength(2000)] public string? LearningNotes { get; init; }
    [MaxLength(30)] public IReadOnlyList<string>? Subjects { get; init; }
    [MaxLength(20)] public IReadOnlyList<string>? AdditionalLanguages { get; init; }
    public TeachingArrangementInputDto? TeachingArrangement { get; init; }
    [MaxLength(28)] public IReadOnlyList<StudentAvailabilityInputDto>? Availability { get; init; }
}

public sealed class StudentStatusUpdateDto
{
    public required bool IsActive { get; init; }
}

public sealed record StudentDto(
    Guid Id,
    string FullName,
    string? Email,
    string? PhoneNumber,
    string Status,
    string? Notes,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    string? PreferredName = null,
    DateOnly? DateOfBirth = null,
    string? GradeOrYear = null,
    string? Country = null,
    string? StateOrProvince = null,
    string? City = null,
    string? TimeZoneId = null,
    string? PreferredTeachingLanguage = null,
    string? LearningNotes = null,
    IReadOnlyList<GuardianDto>? Guardians = null,
    IReadOnlyList<string>? Subjects = null,
    IReadOnlyList<string>? AdditionalLanguages = null,
    TeachingArrangementDto? TeachingArrangement = null,
    IReadOnlyList<StudentAvailabilityDto>? Availability = null);

public sealed record GuardianDto(string FullName, string Relationship, string Email, string? PhoneNumber, bool IsPrimary);
public sealed record TeachingArrangementDto(string TeachingMode, int DefaultClassDurationMinutes, string Status);
public sealed record StudentAvailabilityDto(string DayOfWeek, TimeOnly StartLocalTime, TimeOnly EndLocalTime, string TimeZoneId);

public sealed record StudentListDto(
    IReadOnlyList<StudentDto> Items,
    int Page,
    int PageSize,
    int TotalCount,
    int TotalStudents,
    int ActiveCount,
    int InactiveCount,
    int TotalPages = 0,
    IReadOnlyList<string>? Countries = null,
    IReadOnlyList<string>? GradesOrYears = null,
    IReadOnlyList<string>? TeachingModes = null);

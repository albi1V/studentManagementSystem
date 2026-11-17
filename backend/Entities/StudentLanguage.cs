namespace StudentManagement.Api.Entities;

public sealed class StudentLanguage
{
    public Guid StudentId { get; set; }
    public required string Language { get; set; }
    public Student Student { get; set; } = null!;
}

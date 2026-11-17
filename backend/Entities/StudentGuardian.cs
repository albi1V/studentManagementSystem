namespace StudentManagement.Api.Entities;

public sealed class StudentGuardian
{
    public Guid Id { get; set; }
    public Guid StudentId { get; set; }
    public required string FullName { get; set; }
    public required string Relationship { get; set; }
    public required string Email { get; set; }
    public string? PhoneNumber { get; set; }
    public bool IsPrimary { get; set; } = true;
    public Student Student { get; set; } = null!;
}

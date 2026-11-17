namespace StudentManagement.Api.Entities;

public sealed class Subject
{
    public Guid Id { get; set; }
    public required string Name { get; set; }
    public required string NormalizedName { get; set; }
    public ICollection<StudentSubject> Students { get; set; } = new List<StudentSubject>();
}

public sealed class StudentSubject
{
    public Guid StudentId { get; set; }
    public Guid SubjectId { get; set; }
    public Student Student { get; set; } = null!;
    public Subject Subject { get; set; } = null!;
}

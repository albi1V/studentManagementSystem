using StudentManagement.Api.Entities;

namespace StudentManagement.Api.Entities;

public sealed class AppUser
{
    public Guid Id { get; set; }
    public required string FullName { get; set; }
    public required string Email { get; set; }
    public required string NormalizedEmail { get; set; }
    public required string PasswordHash { get; set; }
    public UserRole Role { get; set; } = UserRole.Teacher;
    public bool EmailVerified { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
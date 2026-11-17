using System.ComponentModel.DataAnnotations;

namespace StudentManagement.Api.DTOs;

public sealed class LoginDto
{
    [Required, EmailAddress, StringLength(254)]
    public required string Email { get; init; }

    [Required]
    public required string Password { get; init; }
}

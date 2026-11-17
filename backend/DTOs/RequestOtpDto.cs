using System.ComponentModel.DataAnnotations;

namespace StudentManagement.Api.DTOs;

public sealed class RequestOtpDto
{
    [Required, StringLength(100, MinimumLength = 2)]
    public required string FullName { get; init; }

    [Required, EmailAddress, StringLength(254)]
    public required string Email { get; init; }

    [Required, MinLength(8)]
    [RegularExpression("^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}$")]
    public required string Password { get; init; }
}
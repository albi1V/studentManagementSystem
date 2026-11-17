using System.ComponentModel.DataAnnotations;

namespace StudentManagement.Api.DTOs;

public sealed class ResendOtpDto
{
    [Required, StringLength(128, MinimumLength = 40)]
    public required string RegistrationReference { get; init; }
}
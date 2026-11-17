using System.ComponentModel.DataAnnotations;

namespace StudentManagement.Api.DTOs;

public sealed class VerifyOtpAndRegisterDto
{
    [Required, StringLength(128, MinimumLength = 40)]
    public required string RegistrationReference { get; init; }

    [Required, RegularExpression("^[0-9]{6}$")]
    public required string Otp { get; init; }
}
namespace StudentManagement.Api.Entities;

/// <summary>Temporary teacher registration. Contains only password and OTP hashes.</summary>
public sealed class EmailOtp
{
    public Guid Id { get; set; }
    public required string RegistrationReferenceHash { get; set; }
    public required string FullName { get; set; }
    public required string Email { get; set; }
    public required string NormalizedEmail { get; set; }
    public required string PasswordHash { get; set; }
    public required byte[] OtpHash { get; set; }
    public DateTimeOffset OtpExpiresAt { get; set; }
    public int VerificationAttempts { get; set; }
    public int ResendCount { get; set; }
    public DateTimeOffset LastOtpSentAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
namespace StudentManagement.Api.DTOs;

public sealed record OtpRegistrationResponseDto(string RegistrationReference, string Email, int ResendCooldownSeconds);
public sealed record ResendOtpResponseDto(int ResendCooldownSeconds);
public sealed record VerifyOtpResponseDto(bool Verified, string Message);
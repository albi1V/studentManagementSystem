namespace StudentManagement.Api.Services;

public interface IEmailSender
{
    bool IsConfigured { get; }
    Task SendRegistrationOtpAsync(string email, string otp, int expiryMinutes, CancellationToken cancellationToken);
}
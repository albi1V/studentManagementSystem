using System.Net;
using System.Net.Mail;

namespace StudentManagement.Api.Services;

public sealed class SmtpEmailSender(IConfiguration configuration) : IEmailSender
{
    private string? Host => configuration["Email:SmtpHost"];
    private string? FromAddress => configuration["Email:FromAddress"];
    private int Port => int.TryParse(configuration["Email:SmtpPort"], out var port) ? port : 587;
    private bool UseSsl => !bool.TryParse(configuration["Email:UseSsl"], out var enabled) || enabled;
    private string? Username => configuration["Email:SmtpUsername"];
    private string? Password => configuration["Email:SmtpPassword"];
    public bool IsConfigured => !string.IsNullOrWhiteSpace(Host)
        && !string.IsNullOrWhiteSpace(FromAddress)
        && Port is > 0 and <= 65535
        && (string.IsNullOrWhiteSpace(Username) || !string.IsNullOrWhiteSpace(Password));

    public async Task SendRegistrationOtpAsync(string email, string otp, int expiryMinutes, CancellationToken cancellationToken)
    {
        if (!IsConfigured) throw new EmailDeliveryException("Email delivery is not configured.");
        try
        {
            using var message = new MailMessage
            {
                From = new MailAddress(FromAddress!, configuration["Email:FromName"] ?? "Student Management System"),
                Subject = "Verify your teacher account",
                IsBodyHtml = true,
                Body = $"<main style=\"font-family:Arial,sans-serif;color:#172033;max-width:560px;margin:auto\"><h1 style=\"font-size:22px\">Verify your email address</h1><p>Use this code to finish creating your teacher account:</p><p style=\"font-size:30px;font-weight:bold;letter-spacing:8px;color:#173d69\">{WebUtility.HtmlEncode(otp)}</p><p>This code expires in {expiryMinutes} minutes. If you did not request this, you can ignore this email.</p><p style=\"color:#718096;font-size:12px\">Student Management System</p></main>",
            };
            message.To.Add(new MailAddress(email));
            using var smtp = new SmtpClient(Host!, Port)
            {
                EnableSsl = UseSsl,
                DeliveryMethod = SmtpDeliveryMethod.Network,
                Timeout = 15000,
            };
            if (!string.IsNullOrWhiteSpace(Username)) smtp.Credentials = new NetworkCredential(Username, Password);
            using var registration = cancellationToken.Register(() => smtp.SendAsyncCancel());
            await smtp.SendMailAsync(message, cancellationToken);
        }
        catch (Exception exception) when (exception is SmtpException or InvalidOperationException or FormatException or ArgumentException or OperationCanceledException)
        {
            throw new EmailDeliveryException("Email delivery failed.", exception);
        }
    }
}

public sealed class EmailDeliveryException(string message, Exception? innerException = null) : Exception(message, innerException);
using System.Data;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Cryptography;
using System.Text;
using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Npgsql;
using StudentManagement.Api.Data;
using StudentManagement.Api.DTOs;
using StudentManagement.Api.Entities;

namespace StudentManagement.Api.Services;

public sealed class AuthService(
    AuthDbContext database,
    IConfiguration configuration,
    IEmailSender emailSender,
    IPasswordHasher<AppUser> passwordHasher) : IAuthService
{
    private int OtpExpiryMinutes => ReadSetting("Otp:ExpiryMinutes", 10, 1, 60);
    private int MaxVerificationAttempts => ReadSetting("Otp:MaxVerificationAttempts", 5, 1, 20);
    private int ResendCooldownSeconds => ReadSetting("Otp:ResendCooldownSeconds", 60, 15, 3600);
    private int MaxResends => ReadSetting("Otp:MaxResends", 5, 0, 20);

    public async Task<AuthResponseDto> LoginAsync(LoginDto request, CancellationToken cancellationToken)
    {
        var normalizedEmail = request.Email.Trim().ToUpperInvariant();
        var user = await database.AppUsers.SingleOrDefaultAsync(
            x => x.NormalizedEmail == normalizedEmail, cancellationToken);

        if (user is null || passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.Password)
            == PasswordVerificationResult.Failed)
        {
            throw new AuthFlowException(401, "INVALID_CREDENTIALS", "Email address or password is incorrect.");
        }

        if (!user.EmailVerified)
            throw new AuthFlowException(403, "EMAIL_NOT_VERIFIED", "Verify your email address before signing in.");

        var issuer = configuration["Jwt:Issuer"]!;
        var audience = configuration["Jwt:Audience"]!;
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(configuration["Jwt:SigningKey"]!));
        var expiresAt = DateTimeOffset.UtcNow.AddMinutes(ReadSetting("Jwt:ExpiryMinutes", 60, 1, 1440));
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Name, user.FullName),
            new Claim(ClaimTypes.Role, user.Role.ToString()),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
        };
        var token = new JwtSecurityToken(
            issuer, audience, claims, DateTime.UtcNow, expiresAt.UtcDateTime,
            new SigningCredentials(key, SecurityAlgorithms.HmacSha256));
        var accessToken = new JwtSecurityTokenHandler().WriteToken(token);

        return new AuthResponseDto(accessToken, expiresAt,
            new AuthenticatedUserDto(user.Id, user.Email, user.FullName, user.Role.ToString()));
    }

    public async Task<OtpRegistrationResponseDto> RequestRegistrationOtpAsync(RequestOtpDto request, CancellationToken cancellationToken)
    {
        EnsureReady();
        var email = request.Email.Trim();
        var normalizedEmail = NormalizeEmail(email);
        if (await database.AppUsers.AnyAsync(x => x.NormalizedEmail == normalizedEmail, cancellationToken))
            throw new AuthFlowException(409, "EMAIL_ALREADY_REGISTERED", "An account with this email address already exists.");
        var existingPending = await database.EmailOtps.SingleOrDefaultAsync(x => x.NormalizedEmail == normalizedEmail, cancellationToken);
        if (existingPending is not null)
        {
            if (existingPending.OtpExpiresAt > DateTimeOffset.UtcNow)
                throw new AuthFlowException(409, "REGISTRATION_PENDING", "A verification is already pending for this email address. Check your email or wait for the code to expire.");
            database.EmailOtps.Remove(existingPending);
            await database.SaveChangesAsync(cancellationToken);
        }

        var now = DateTimeOffset.UtcNow;
        var rawReference = CreateOpaqueReference();
        var referenceHash = HashReference(rawReference);
        var code = CreateOtp();
        var userForHash = new AppUser
        {
            Id = Guid.NewGuid(), FullName = request.FullName.Trim(), Email = email, NormalizedEmail = normalizedEmail,
            PasswordHash = string.Empty, Role = UserRole.Teacher, EmailVerified = false, CreatedAt = now,
        };
        var pending = new EmailOtp
        {
            Id = Guid.NewGuid(), RegistrationReferenceHash = referenceHash, FullName = userForHash.FullName,
            Email = email, NormalizedEmail = normalizedEmail,
            PasswordHash = passwordHasher.HashPassword(userForHash, request.Password),
            OtpHash = HashOtp(code, referenceHash), OtpExpiresAt = now.AddMinutes(OtpExpiryMinutes),
            VerificationAttempts = 0, ResendCount = 0, LastOtpSentAt = now, CreatedAt = now,
        };

        database.EmailOtps.Add(pending);
        try
        {
            await database.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException error) when (error.InnerException is PostgresException postgresError && postgresError.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            throw new AuthFlowException(409, "REGISTRATION_PENDING", "A registration is already pending for this email address.");
        }

        try
        {
            await emailSender.SendRegistrationOtpAsync(email, code, OtpExpiryMinutes, cancellationToken);
        }
        catch (EmailDeliveryException)
        {
            database.EmailOtps.Remove(pending);
            await database.SaveChangesAsync(CancellationToken.None);
            throw new AuthFlowException(503, "EMAIL_DELIVERY_FAILED", "We could not send a verification email. No account was created. Please try again later.");
        }

        return new OtpRegistrationResponseDto(rawReference, email, ResendCooldownSeconds);
    }

    public async Task<ResendOtpResponseDto> ResendRegistrationOtpAsync(ResendOtpDto request, CancellationToken cancellationToken)
    {
        EnsureReady();
        var pending = await FindPendingAsync(request.RegistrationReference, cancellationToken);
        var now = DateTimeOffset.UtcNow;
        
        var remaining = Math.Max(0, (int)Math.Ceiling((pending.LastOtpSentAt.AddSeconds(ResendCooldownSeconds) - now).TotalSeconds));
        if (remaining > 0) throw new AuthFlowException(429, "OTP_COOLDOWN", "Please wait before requesting another verification code.", remaining);
        if (pending.ResendCount >= MaxResends)
            throw new AuthFlowException(429, "OTP_RESEND_LIMIT", "The verification code resend limit has been reached. Please try again later.");

        var priorHash = pending.OtpHash;
        var priorExpiry = pending.OtpExpiresAt;
        var priorSentAt = pending.LastOtpSentAt;
        var priorCount = pending.ResendCount;
        var priorAttempts = pending.VerificationAttempts;
        var code = CreateOtp();
        pending.OtpHash = HashOtp(code, pending.RegistrationReferenceHash);
        pending.OtpExpiresAt = now.AddMinutes(OtpExpiryMinutes);
        pending.LastOtpSentAt = now;
        pending.ResendCount += 1;
        pending.VerificationAttempts = 0;
        try
        {
            await database.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            database.Entry(pending).State = EntityState.Detached;
            var current = await database.EmailOtps.AsNoTracking().SingleOrDefaultAsync(
                x => x.RegistrationReferenceHash == pending.RegistrationReferenceHash, cancellationToken);
            if (current is null)
                throw new AuthFlowException(404, "REGISTRATION_NOT_FOUND", "This registration is no longer available. Start registration again.");
            var retryAfter = Math.Max(1, (int)Math.Ceiling((current.LastOtpSentAt.AddSeconds(ResendCooldownSeconds) - DateTimeOffset.UtcNow).TotalSeconds));
            throw new AuthFlowException(429, "OTP_COOLDOWN", "Please wait before requesting another verification code.", retryAfter);
        }

        try
        {
            await emailSender.SendRegistrationOtpAsync(pending.Email, code, OtpExpiryMinutes, cancellationToken);
        }
        catch (EmailDeliveryException)
        {
            pending.OtpHash = priorHash;
            pending.OtpExpiresAt = priorExpiry;
            pending.LastOtpSentAt = priorSentAt;
            pending.ResendCount = priorCount;
            pending.VerificationAttempts = priorAttempts;
            await database.SaveChangesAsync(CancellationToken.None);
            throw new AuthFlowException(503, "EMAIL_DELIVERY_FAILED", "We could not send a new verification email. Please try again later.");
        }

        return new ResendOtpResponseDto(ResendCooldownSeconds);
    }

    public async Task<VerifyOtpResponseDto> VerifyRegistrationOtpAsync(VerifyOtpAndRegisterDto request, CancellationToken cancellationToken)
    {
        EnsureReady();
        await using var transaction = await database.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
        var pending = await FindPendingAsync(request.RegistrationReference, cancellationToken);
        var now = DateTimeOffset.UtcNow;
        EnsurePendingUsable(pending, now);

        var submittedHash = HashOtp(request.Otp, pending.RegistrationReferenceHash);
        if (!CryptographicOperations.FixedTimeEquals(submittedHash, pending.OtpHash))
        {
            pending.VerificationAttempts += 1;
            var exceeded = pending.VerificationAttempts >= MaxVerificationAttempts;
            await database.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            if (exceeded)
                throw new AuthFlowException(429, "OTP_ATTEMPTS_EXCEEDED", "The maximum verification attempts have been reached. Request a new code to continue.");
            throw new AuthFlowException(400, "OTP_INVALID", "The verification code is not correct.");
        }

        if (await database.AppUsers.AnyAsync(x => x.NormalizedEmail == pending.NormalizedEmail, cancellationToken))
            throw new AuthFlowException(409, "EMAIL_ALREADY_REGISTERED", "An account with this email address already exists.");

        var teacher = new AppUser
        {
            Id = Guid.NewGuid(), FullName = pending.FullName, Email = pending.Email,
            NormalizedEmail = pending.NormalizedEmail, PasswordHash = pending.PasswordHash,
            Role = UserRole.Teacher, EmailVerified = true, CreatedAt = now,
        };
        database.AppUsers.Add(teacher);
        database.EmailOtps.Remove(pending);
        await database.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return new VerifyOtpResponseDto(true, "Your email is verified and your teacher account is ready. You can sign in now.");
    }

    private async Task<EmailOtp> FindPendingAsync(string reference, CancellationToken cancellationToken)
    {
        var hash = HashReference(reference);
        var pending = await database.EmailOtps.SingleOrDefaultAsync(x => x.RegistrationReferenceHash == hash, cancellationToken);
        return pending ?? throw new AuthFlowException(404, "REGISTRATION_NOT_FOUND", "This registration is no longer available. Start registration again.");
    }

    private void EnsurePendingUsable(EmailOtp pending, DateTimeOffset now)
    {
        EnsureNotExpired(pending, now);
        if (pending.VerificationAttempts >= MaxVerificationAttempts)
            throw new AuthFlowException(429, "OTP_ATTEMPTS_EXCEEDED", "The maximum verification attempts have been reached. Request a new code to continue.");
    }

    private void EnsureNotExpired(EmailOtp pending, DateTimeOffset now)
    {
        if (pending.OtpExpiresAt <= now)
            throw new AuthFlowException(410, "OTP_EXPIRED", "This verification code has expired. Request a new code to continue.");
    }

    private void EnsureReady()
    {
        if (string.IsNullOrWhiteSpace(configuration.GetConnectionString("DefaultConnection")))
            throw new AuthFlowException(503, "DATABASE_CONFIGURATION_MISSING", "Registration is unavailable until the database connection is configured.");
        var key = configuration["Otp:HmacKey"];
        if (string.IsNullOrWhiteSpace(key) || Encoding.UTF8.GetByteCount(key) < 32)
            throw new AuthFlowException(503, "OTP_CONFIGURATION_MISSING", "Registration is unavailable until the OTP signing key is configured.");
        if (!emailSender.IsConfigured)
            throw new AuthFlowException(503, "EMAIL_CONFIGURATION_MISSING", "Registration is unavailable until SMTP email delivery is configured.");
    }

    private byte[] HashOtp(string otp, string referenceHash)
    {
        var key = Encoding.UTF8.GetBytes(configuration["Otp:HmacKey"]!);
        using var hmac = new HMACSHA256(key);
        return hmac.ComputeHash(Encoding.UTF8.GetBytes($"{referenceHash}:{otp}"));
    }

    private static string NormalizeEmail(string email) => email.Trim().ToUpperInvariant();
    private int ReadSetting(string key, int fallback, int minimum, int maximum) =>
        int.TryParse(configuration[key], out var value) ? Math.Clamp(value, minimum, maximum) : fallback;
    private static string CreateOtp() => RandomNumberGenerator.GetInt32(100000, 1000000).ToString("D6");
    private static string CreateOpaqueReference() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    private static string HashReference(string reference) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(reference)));
}

public sealed class AuthFlowException(int statusCode, string code, string message, int? retryAfterSeconds = null) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
    public string Code { get; } = code;
    public int? RetryAfterSeconds { get; } = retryAfterSeconds;
}

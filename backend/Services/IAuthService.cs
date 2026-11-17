using StudentManagement.Api.DTOs;

namespace StudentManagement.Api.Services;

public interface IAuthService
{
    Task<AuthResponseDto> LoginAsync(LoginDto request, CancellationToken cancellationToken);
    Task<OtpRegistrationResponseDto> RequestRegistrationOtpAsync(RequestOtpDto request, CancellationToken cancellationToken);
    Task<ResendOtpResponseDto> ResendRegistrationOtpAsync(ResendOtpDto request, CancellationToken cancellationToken);
    Task<VerifyOtpResponseDto> VerifyRegistrationOtpAsync(VerifyOtpAndRegisterDto request, CancellationToken cancellationToken);
}

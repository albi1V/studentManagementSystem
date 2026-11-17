using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using StudentManagement.Api.DTOs;
using StudentManagement.Api.Services;

namespace StudentManagement.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(IAuthService authService) : ControllerBase
{
    [HttpPost("login")]
    [EnableRateLimiting("login")]
    [ProducesResponseType<AuthResponseDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Login([FromBody] LoginDto request, CancellationToken cancellationToken)
    {
        try { return Ok(await authService.LoginAsync(request, cancellationToken)); }
        catch (AuthFlowException error) { return ToProblem(error); }
    }

    [Authorize]
    [HttpGet("me")]
    [ProducesResponseType<AuthenticatedUserDto>(StatusCodes.Status200OK)]
    public IActionResult Me()
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id)
            || User.FindFirstValue(ClaimTypes.Email) is not { } email
            || User.FindFirstValue(ClaimTypes.Name) is not { } fullName
            || User.FindFirstValue(ClaimTypes.Role) is not { } role)
        {
            return Unauthorized();
        }

        return Ok(new AuthenticatedUserDto(id, email, fullName, role));
    }

    [HttpPost("register")]
    [EnableRateLimiting("otp")]
    [ProducesResponseType<OtpRegistrationResponseDto>(StatusCodes.Status202Accepted)]
    public async Task<IActionResult> Register([FromBody] RequestOtpDto request, CancellationToken cancellationToken)
    {
        try
        {
            var response = await authService.RequestRegistrationOtpAsync(request, cancellationToken);
            return Accepted(response);
        }
        catch (AuthFlowException error) { return ToProblem(error); }
    }

    [HttpPost("verify-otp")]
    [EnableRateLimiting("otp")]
    [ProducesResponseType<VerifyOtpResponseDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> VerifyOtp([FromBody] VerifyOtpAndRegisterDto request, CancellationToken cancellationToken)
    {
        try { return Ok(await authService.VerifyRegistrationOtpAsync(request, cancellationToken)); }
        catch (AuthFlowException error) { return ToProblem(error); }
    }

    [HttpPost("resend-otp")]
    [EnableRateLimiting("otp")]
    [ProducesResponseType<ResendOtpResponseDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> ResendOtp([FromBody] ResendOtpDto request, CancellationToken cancellationToken)
    {
        try { return Ok(await authService.ResendRegistrationOtpAsync(request, cancellationToken)); }
        catch (AuthFlowException error) { return ToProblem(error); }
    }

    private ObjectResult ToProblem(AuthFlowException error)
    {
        if (error.RetryAfterSeconds is > 0) Response.Headers.RetryAfter = error.RetryAfterSeconds.Value.ToString();
        var problem = new ProblemDetails { Status = error.StatusCode, Title = error.Message };
        problem.Extensions["code"] = error.Code;
        if (error.RetryAfterSeconds is > 0) problem.Extensions["resendCooldownSeconds"] = error.RetryAfterSeconds.Value;
        return new ObjectResult(problem) { StatusCode = error.StatusCode };
    }
}

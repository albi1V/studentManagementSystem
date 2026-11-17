namespace StudentManagement.Api.DTOs;

public sealed record AuthenticatedUserDto(Guid Id, string Email, string FullName, string Role);
public sealed record AuthResponseDto(string AccessToken, DateTimeOffset ExpiresAt, AuthenticatedUserDto User);

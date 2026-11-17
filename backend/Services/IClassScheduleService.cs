using StudentManagement.Api.DTOs;

namespace StudentManagement.Api.Services;

public interface IClassScheduleService
{
    Task<IReadOnlyList<ScheduleStudentDto>> GetEligibleStudentsAsync(Guid teacherId, CancellationToken cancellationToken);
    Task<IReadOnlyList<ClassScheduleDto>> GetSchedulesAsync(Guid teacherId, CancellationToken cancellationToken);
    Task<ClassScheduleDto?> GetScheduleAsync(Guid teacherId, Guid id, CancellationToken cancellationToken);
    Task<ClassSchedulePreviewDto> PreviewAsync(Guid teacherId, CreateClassScheduleDto request, CancellationToken cancellationToken);
    Task<ClassScheduleDto> CreateScheduleAsync(Guid teacherId, CreateClassScheduleDto request, CancellationToken cancellationToken);
}

public sealed class ScheduleConflictException(string message) : Exception(message);

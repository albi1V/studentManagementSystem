using StudentManagement.Api.DTOs;

namespace StudentManagement.Api.Services;

public interface IStudentService
{
    Task<StudentListDto> GetStudentsAsync(Guid teacherId, string? search, int page, int pageSize, bool? isActive, string? country, string? gradeOrYear, string? teachingMode, CancellationToken cancellationToken);
    Task<StudentDto?> GetStudentAsync(Guid teacherId, Guid id, CancellationToken cancellationToken);
    Task<StudentDto> CreateStudentAsync(Guid teacherId, CreateStudentDto request, CancellationToken cancellationToken);
    Task<StudentDto?> UpdateStudentAsync(Guid teacherId, Guid id, UpdateStudentDto request, CancellationToken cancellationToken);
    Task<StudentDto?> UpdateStudentStatusAsync(Guid teacherId, Guid id, bool isActive, CancellationToken cancellationToken);
}

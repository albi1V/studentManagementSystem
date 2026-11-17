using System.Security.Claims;
using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudentManagement.Api.DTOs;
using StudentManagement.Api.Entities;
using StudentManagement.Api.Services;

namespace StudentManagement.Api.Controllers;

[ApiController]
[Route("api/students")]
[Authorize(Roles = nameof(UserRole.Teacher))]
public sealed class StudentsController(IStudentService students) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType<StudentListDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        [FromQuery, StringLength(100)] string? search,
        [FromQuery, Range(1, int.MaxValue)] int page = 1,
        [FromQuery, Range(1, 100)] int pageSize = 10,
        [FromQuery] bool? isActive = null,
        [FromQuery, StringLength(100)] string? country = null,
        [FromQuery, StringLength(100)] string? gradeOrYear = null,
        [FromQuery, StringLength(20)] string? teachingMode = null,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetTeacherId(out var teacherId)) return Forbid();
        return Ok(await students.GetStudentsAsync(teacherId, search, page, pageSize, isActive, country, gradeOrYear, teachingMode, cancellationToken));
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType<StudentDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Get(Guid id, CancellationToken cancellationToken)
    {
        if (!TryGetTeacherId(out var teacherId)) return Forbid();
        var student = await students.GetStudentAsync(teacherId, id, cancellationToken);
        return student is null ? NotFound() : Ok(student);
    }

    [HttpPost]
    [ProducesResponseType<StudentDto>(StatusCodes.Status201Created)]
    public async Task<IActionResult> Create([FromBody] CreateStudentDto request, CancellationToken cancellationToken)
    {
        if (!TryGetTeacherId(out var teacherId)) return Forbid();
        try
        {
            var student = await students.CreateStudentAsync(teacherId, request, cancellationToken);
            return CreatedAtAction(nameof(Get), new { id = student.Id }, student);
        }
        catch (ValidationException ex)
        {
            ModelState.AddModelError("onboarding", ex.Message);
            return ValidationProblem(ModelState);
        }
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType<StudentDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateStudentDto request, CancellationToken cancellationToken)
    {
        if (!TryGetTeacherId(out var teacherId)) return Forbid();
        try
        {
            var student = await students.UpdateStudentAsync(teacherId, id, request, cancellationToken);
            return student is null ? NotFound() : Ok(student);
        }
        catch (ValidationException ex)
        {
            ModelState.AddModelError("student", ex.Message);
            return ValidationProblem(ModelState);
        }
    }

    [HttpPatch("{id:guid}/status")]
    [ProducesResponseType<StudentDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] StudentStatusUpdateDto request, CancellationToken cancellationToken)
    {
        if (!TryGetTeacherId(out var teacherId)) return Forbid();
        var student = await students.UpdateStudentStatusAsync(teacherId, id, request.IsActive, cancellationToken);
        return student is null ? NotFound() : Ok(student);
    }

    private bool TryGetTeacherId(out Guid teacherId) =>
        Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out teacherId);
}

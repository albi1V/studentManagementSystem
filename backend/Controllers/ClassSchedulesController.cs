using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
using StudentManagement.Api.DTOs;
using StudentManagement.Api.Entities;
using StudentManagement.Api.Services;

namespace StudentManagement.Api.Controllers;

[ApiController]
[Route("api/class-schedules")]
[Authorize(Roles = nameof(UserRole.Teacher))]
public sealed class ClassSchedulesController(IClassScheduleService schedules) : ControllerBase
{
    [HttpGet("students")]
    public async Task<IActionResult> GetStudents(CancellationToken cancellationToken) =>
        TryGetTeacherId(out var teacherId) ? Ok(await schedules.GetEligibleStudentsAsync(teacherId, cancellationToken)) : Forbid();

    [HttpGet]
    public async Task<IActionResult> GetSchedules(CancellationToken cancellationToken) =>
        TryGetTeacherId(out var teacherId) ? Ok(await schedules.GetSchedulesAsync(teacherId, cancellationToken)) : Forbid();

    [HttpPost("preview")]
    public async Task<IActionResult> Preview([FromBody] CreateClassScheduleDto request, CancellationToken cancellationToken)
    {
        if (!TryGetTeacherId(out var teacherId)) return Forbid();
        try { return Ok(await schedules.PreviewAsync(teacherId, request, cancellationToken)); }
        catch (ValidationException ex)
        {
            ModelState.AddModelError("schedule", ex.Message);
            return ValidationProblem(ModelState);
        }
        catch (ScheduleConflictException ex)
        {
            return Conflict(new ProblemDetails { Status = StatusCodes.Status409Conflict, Title = "Schedule conflict", Detail = ex.Message });
        }
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetSchedule(Guid id, CancellationToken cancellationToken)
    {
        if (!TryGetTeacherId(out var teacherId)) return Forbid();
        var item = await schedules.GetScheduleAsync(teacherId, id, cancellationToken);
        return item is null ? NotFound() : Ok(item);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateClassScheduleDto request, CancellationToken cancellationToken)
    {
        if (!TryGetTeacherId(out var teacherId)) return Forbid();
        try
        {
            var item = await schedules.CreateScheduleAsync(teacherId, request, cancellationToken);
            return CreatedAtAction(nameof(GetSchedule), new { id = item.Id }, item);
        }
        catch (ValidationException ex)
        {
            ModelState.AddModelError("schedule", ex.Message);
            return ValidationProblem(ModelState);
        }
        catch (ScheduleConflictException ex)
        {
            return Conflict(new ProblemDetails { Status = StatusCodes.Status409Conflict, Title = "Schedule conflict", Detail = ex.Message });
        }
        catch (PostgresException ex) when (ex.SqlState == "40001")
        {
            return Conflict(new ProblemDetails { Status = StatusCodes.Status409Conflict, Title = "Schedule conflict", Detail = "The schedule changed while this class was being saved. Refresh and try again." });
        }
    }

    private bool TryGetTeacherId(out Guid teacherId) =>
        Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out teacherId);
}

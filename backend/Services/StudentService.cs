using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using System.Text.RegularExpressions;
using StudentManagement.Api.Data;
using StudentManagement.Api.DTOs;
using StudentManagement.Api.Entities;

namespace StudentManagement.Api.Services;

public sealed class StudentService(AuthDbContext database) : IStudentService
{
    public async Task<StudentListDto> GetStudentsAsync(
        Guid teacherId, string? search, int page, int pageSize, bool? isActive, string? country, string? gradeOrYear, string? teachingMode, CancellationToken cancellationToken)
    {
        var teacherStudents = database.Students.AsNoTracking().Where(x => x.TeacherId == teacherId);
        var totalStudents = await teacherStudents.CountAsync(cancellationToken);
        var activeCount = await teacherStudents.CountAsync(x => x.Status == StudentStatus.Active, cancellationToken);
        var inactiveCount = totalStudents - activeCount;

        var query = teacherStudents.AsQueryable();
        if (isActive.HasValue)
            query = query.Where(x => x.Status == (isActive.Value ? StudentStatus.Active : StudentStatus.Inactive));

        var term = search?.Trim().ToLowerInvariant();
        if (!string.IsNullOrEmpty(term))
        {
            query = query.Where(x => x.FullName.ToLower().Contains(term)
                || (x.PreferredName != null && x.PreferredName.ToLower().Contains(term))
                || (x.Email != null && x.Email.ToLower().Contains(term))
                );
        }

        if (!string.IsNullOrWhiteSpace(country)) query = query.Where(x => x.Country != null && x.Country.ToLower() == country.Trim().ToLower());
        if (!string.IsNullOrWhiteSpace(gradeOrYear)) query = query.Where(x => x.GradeOrYear != null && x.GradeOrYear.ToLower() == gradeOrYear.Trim().ToLower());
        if (Enum.TryParse<TeachingMode>(teachingMode, true, out var mode)) query = query.Where(x => x.Enrollments.Any(e => e.TeachingMode == mode));

        var totalCount = await query.CountAsync(cancellationToken);
        var students = await query
            .Include(x => x.Subjects).ThenInclude(x => x.Subject)
            .Include(x => x.Enrollments)
            .AsSplitQuery()
            .OrderBy(x => x.FullName)
            .ThenBy(x => x.Id)
            .Skip((int)Math.Min((long)(page - 1) * pageSize, int.MaxValue))
            .Take(pageSize)
            .ToListAsync(cancellationToken);
        var items = students.Select(ToDto).ToList();

        var countries = await teacherStudents.Where(x => x.Country != null).Select(x => x.Country!).Distinct().OrderBy(x => x).ToListAsync(cancellationToken);
        var grades = await teacherStudents.Where(x => x.GradeOrYear != null).Select(x => x.GradeOrYear!).Distinct().OrderBy(x => x).ToListAsync(cancellationToken);
        return new StudentListDto(items, page, pageSize, totalCount, totalStudents, activeCount, inactiveCount,
            (int)Math.Ceiling(totalCount / (double)pageSize), countries, grades, [nameof(TeachingMode.OneToOne), nameof(TeachingMode.Group)]);
    }

    public async Task<StudentDto?> GetStudentAsync(Guid teacherId, Guid id, CancellationToken cancellationToken)
    {
        var student = await database.Students.AsNoTracking()
            .Include(x => x.Guardians)
            .Include(x => x.Subjects).ThenInclude(x => x.Subject)
            .Include(x => x.AdditionalLanguages)
            .Include(x => x.Enrollments).ThenInclude(x => x.Availability)
            .AsSplitQuery()
            .SingleOrDefaultAsync(x => x.Id == id && x.TeacherId == teacherId, cancellationToken);
        return student is null ? null : ToDto(student);
    }

    public async Task<StudentDto> CreateStudentAsync(Guid teacherId, CreateStudentDto request, CancellationToken cancellationToken)
    {
        ValidateOnboarding(request);
        var now = DateTimeOffset.UtcNow;
        var timeZoneId = Normalize(request.TimeZoneId);
        var student = new Student
        {
            Id = Guid.NewGuid(),
            TeacherId = teacherId,
            FullName = CleanName(request.FullName),
            PreferredName = NormalizeOptional(request.PreferredName),
            DateOfBirth = request.DateOfBirth,
            GradeOrYear = Normalize(request.GradeOrYear),
            Email = NormalizeOptional(request.Email),
            PhoneNumber = NormalizeOptional(request.PhoneNumber),
            Notes = NormalizeOptional(request.Notes),
            Country = Normalize(request.Country),
            StateOrProvince = NormalizeOptional(request.StateOrProvince),
            City = Normalize(request.City),
            TimeZoneId = timeZoneId,
            PreferredTeachingLanguage = Normalize(request.PreferredTeachingLanguage),
            LearningNotes = NormalizeOptional(request.LearningNotes),
            Status = StudentStatus.Active,
            CreatedAt = now,
            UpdatedAt = now,
        };

        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        database.Students.Add(student);
        student.Guardians.Add(new StudentGuardian
        {
            Id = Guid.NewGuid(), StudentId = student.Id, Student = student,
            FullName = CleanName(request.Guardian.FullName),
            Relationship = Normalize(request.Guardian.Relationship),
            Email = Normalize(request.Guardian.Email).ToLowerInvariant(),
            PhoneNumber = NormalizeOptional(request.Guardian.PhoneNumber), IsPrimary = true,
        });

        var subjectNames = request.Subjects.Select(Normalize).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        var normalizedNames = subjectNames.Select(NormalizeSubject).ToArray();
        var existing = await database.Subjects.Where(x => normalizedNames.Contains(x.NormalizedName)).ToListAsync(cancellationToken);
        foreach (var name in subjectNames)
        {
            var normalized = NormalizeSubject(name);
            var subject = existing.SingleOrDefault(x => x.NormalizedName == normalized);
            if (subject is null)
            {
                subject = new Subject { Id = Guid.NewGuid(), Name = name, NormalizedName = normalized };
                database.Subjects.Add(subject);
                existing.Add(subject);
            }
            student.Subjects.Add(new StudentSubject { StudentId = student.Id, Student = student, SubjectId = subject.Id, Subject = subject });
        }

        foreach (var language in request.AdditionalLanguages.Select(Normalize).Distinct(StringComparer.OrdinalIgnoreCase))
            student.AdditionalLanguages.Add(new StudentLanguage { StudentId = student.Id, Student = student, Language = language });

        var arrangement = new StudentEnrollment
        {
            Id = Guid.NewGuid(), StudentId = student.Id, Student = student,
            TeachingMode = Enum.Parse<TeachingMode>(request.TeachingArrangement.TeachingMode, true),
            DefaultClassDurationMinutes = request.TeachingArrangement.DefaultClassDurationMinutes,
            Status = EnrollmentStatus.Active, CreatedAt = now,
        };
        foreach (var window in request.Availability)
            arrangement.Availability.Add(new StudentAvailability
            {
                Id = Guid.NewGuid(), StudentEnrollmentId = arrangement.Id, Enrollment = arrangement,
                DayOfWeek = Enum.Parse<DayOfWeek>(window.DayOfWeek, true),
                StartLocalTime = window.StartLocalTime, EndLocalTime = window.EndLocalTime, TimeZoneId = timeZoneId,
            });
        student.Enrollments.Add(arrangement);
        await database.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return ToDto(student);
    }

    private static void ValidateOnboarding(CreateStudentDto request)
    {
        static void RequireText(string value, string field, int max)
        {
            if (string.IsNullOrWhiteSpace(value) || value.Trim().Length > max)
                throw new ValidationException($"{field} is required and must be at most {max} characters.");
        }
        static void ValidatePhone(string? phone, string field)
        {
            if (string.IsNullOrWhiteSpace(phone)) return;
            var value = phone.Trim();
            var digits = Regex.Replace(value, "\\D", "");
            if (value.Length > 30 || digits.Length is < 6 or > 15 || !Regex.IsMatch(value, @"^\+?[0-9().\s-]+$"))
                throw new ValidationException($"{field} must be a valid international phone number.");
        }
        RequireText(request.FullName, "Student name", 100);
        if (request.FullName.Trim().Length < 2) throw new ValidationException("Student name must contain at least 2 characters.");
        RequireText(request.GradeOrYear, "Grade / Year", 100);
        if (request.DateOfBirth is { } dateOfBirth && dateOfBirth > DateOnly.FromDateTime(DateTime.UtcNow))
            throw new ValidationException("Date of birth cannot be in the future.");
        RequireText(request.Country, "Country", 100);
        if (request.StateOrProvince?.Trim().Length > 100)
            throw new ValidationException("State / Province must be at most 100 characters.");
        RequireText(request.City, "City", 100);
        RequireText(request.TimeZoneId, "Timezone", 100);
        RequireText(request.PreferredTeachingLanguage, "Preferred teaching language", 100);
        RequireText(request.Guardian.FullName, "Guardian name", 100);
        if (request.Guardian.FullName.Trim().Length < 2) throw new ValidationException("Guardian name must contain at least 2 characters.");
        RequireText(request.Guardian.Email, "Guardian email", 254);
        if (!new EmailAddressAttribute().IsValid(request.Guardian.Email.Trim())) throw new ValidationException("Enter a valid guardian email address.");
        if (!new[] { "Mother", "Father", "Guardian", "Other" }.Contains(request.Guardian.Relationship, StringComparer.OrdinalIgnoreCase))
            throw new ValidationException("Select a valid guardian relationship.");
        ValidatePhone(request.PhoneNumber, "Student phone");
        ValidatePhone(request.Guardian.PhoneNumber, "Guardian phone");
        if (!string.IsNullOrWhiteSpace(request.Email) && !new EmailAddressAttribute().IsValid(request.Email.Trim()))
            throw new ValidationException("Enter a valid student email address.");
        if (request.Subjects.Count is < 1 or > 30 || request.Subjects.Any(x => string.IsNullOrWhiteSpace(x) || x.Trim().Length > 100))
            throw new ValidationException("Select between 1 and 30 valid subjects.");
        if (request.AdditionalLanguages.Any(x => string.IsNullOrWhiteSpace(x) || x.Trim().Length > 100))
            throw new ValidationException("Additional language names must be at most 100 characters.");
        if (!Enum.TryParse<TeachingMode>(request.TeachingArrangement.TeachingMode, true, out _) ||
            request.TeachingArrangement.DefaultClassDurationMinutes is not (30 or 45 or 60 or 90))
            throw new ValidationException("Choose a valid teaching mode and class duration.");
        if (!TimeZoneInfo.TryConvertIanaIdToWindowsId(request.TimeZoneId.Trim(), out _))
            throw new ValidationException("Select a valid IANA timezone identifier.");
        try { _ = TimeZoneInfo.FindSystemTimeZoneById(request.TimeZoneId.Trim()); }
        catch (TimeZoneNotFoundException) { throw new ValidationException("Select a valid IANA timezone identifier."); }
        catch (InvalidTimeZoneException) { throw new ValidationException("Select a valid IANA timezone identifier."); }
        if (request.Availability.Count > 28) throw new ValidationException("You can add up to 28 availability windows.");
        foreach (var window in request.Availability)
        {
            if (!Enum.TryParse<DayOfWeek>(window.DayOfWeek, true, out _) || window.EndLocalTime <= window.StartLocalTime)
                throw new ValidationException("Each availability window needs a valid day and an end time after its start time.");
        }
    }

    private static string CleanName(string value) => Regex.Replace(value.Trim(), @"\s+", " ");
    private static string Normalize(string value) => value.Trim();
    private static string NormalizeSubject(string value) => Regex.Replace(value.Trim().ToUpperInvariant(), @"\s+", " ");

    public async Task<StudentDto?> UpdateStudentAsync(Guid teacherId, Guid id, UpdateStudentDto request, CancellationToken cancellationToken)
    {
        var student = await database.Students.SingleOrDefaultAsync(
            x => x.Id == id && x.TeacherId == teacherId, cancellationToken);
        if (student is null) return null;

        ValidateUpdate(request, student);

        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        student.FullName = CleanName(request.FullName);
        student.PreferredName = NormalizeOptional(request.PreferredName);
        student.DateOfBirth = request.DateOfBirth;
        student.GradeOrYear = NormalizeOptional(request.GradeOrYear);
        student.Email = NormalizeOptional(request.Email);
        student.PhoneNumber = NormalizeOptional(request.PhoneNumber);
        student.Notes = NormalizeOptional(request.Notes);
        student.Country = NormalizeOptional(request.Country);
        student.StateOrProvince = NormalizeOptional(request.StateOrProvince);
        student.City = NormalizeOptional(request.City);
        if (request.TimeZoneId is not null)
        {
            student.TimeZoneId = request.TimeZoneId.Trim();
            var enrollments = await database.StudentEnrollments.Include(x => x.Availability)
                .Where(x => x.StudentId == id).ToListAsync(cancellationToken);
            foreach (var availability in enrollments.SelectMany(x => x.Availability)) availability.TimeZoneId = student.TimeZoneId;
        }
        student.PreferredTeachingLanguage = NormalizeOptional(request.PreferredTeachingLanguage);
        student.LearningNotes = NormalizeOptional(request.LearningNotes);
        if (request.Guardian is not null)
        {
            var guardian = await database.StudentGuardians.Where(x => x.StudentId == id).OrderByDescending(x => x.IsPrimary).FirstOrDefaultAsync(cancellationToken);
            if (guardian is null) { guardian = new StudentGuardian { Id = Guid.NewGuid(), StudentId = id, Student = student, FullName = CleanName(request.Guardian.FullName), Relationship = request.Guardian.Relationship.Trim(), Email = request.Guardian.Email.Trim().ToLowerInvariant(), PhoneNumber = NormalizeOptional(request.Guardian.PhoneNumber), IsPrimary = true }; database.StudentGuardians.Add(guardian); }
            else { guardian.FullName = CleanName(request.Guardian.FullName); guardian.Relationship = request.Guardian.Relationship.Trim(); guardian.Email = request.Guardian.Email.Trim().ToLowerInvariant(); guardian.PhoneNumber = NormalizeOptional(request.Guardian.PhoneNumber); }
        }
        if (request.Subjects is not null)
        {
            var selected = request.Subjects.Select(Normalize).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
            var normalizedNames = selected.Select(NormalizeSubject).ToArray();
            var existing = await database.Subjects.Where(x => normalizedNames.Contains(x.NormalizedName)).ToListAsync(cancellationToken);
            var currentLinks = await database.StudentSubjects.Where(x => x.StudentId == id).ToListAsync(cancellationToken);
            var currentSubjectIds = currentLinks.Select(x => x.SubjectId).ToHashSet();
            var requestedSubjectIds = new HashSet<Guid>();
            foreach (var name in selected)
            {
                var normalized = NormalizeSubject(name);
                var subject = existing.SingleOrDefault(x => x.NormalizedName == normalized);
                if (subject is null) { subject = new Subject { Id = Guid.NewGuid(), Name = name, NormalizedName = normalized }; database.Subjects.Add(subject); existing.Add(subject); }
                requestedSubjectIds.Add(subject.Id);
                if (!currentSubjectIds.Contains(subject.Id)) database.StudentSubjects.Add(new StudentSubject { StudentId = id, SubjectId = subject.Id });
            }
            database.StudentSubjects.RemoveRange(currentLinks.Where(x => !requestedSubjectIds.Contains(x.SubjectId)));
        }
        if (request.AdditionalLanguages is not null)
        {
            var currentLanguages = await database.StudentLanguages.Where(x => x.StudentId == id).ToListAsync(cancellationToken);
            var requestedLanguages = request.AdditionalLanguages.Select(Normalize).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
            database.StudentLanguages.RemoveRange(currentLanguages.Where(x => !requestedLanguages.Contains(x.Language, StringComparer.OrdinalIgnoreCase)));
            var currentLanguageNames = currentLanguages.Select(x => x.Language).ToHashSet(StringComparer.OrdinalIgnoreCase);
            foreach (var language in requestedLanguages.Where(x => !currentLanguageNames.Contains(x)))
                database.StudentLanguages.Add(new StudentLanguage { StudentId = id, Language = language });
        }
        if (request.TeachingArrangement is not null || request.Availability is not null)
        {
            var enrollment = await database.StudentEnrollments.Include(x => x.Availability).FirstOrDefaultAsync(x => x.StudentId == id, cancellationToken);
            if (enrollment is null) { enrollment = new StudentEnrollment { Id = Guid.NewGuid(), StudentId = id, Student = student, TeachingMode = TeachingMode.OneToOne, DefaultClassDurationMinutes = 60, CreatedAt = DateTimeOffset.UtcNow }; database.StudentEnrollments.Add(enrollment); }
            if (request.TeachingArrangement is not null) { Enum.TryParse<TeachingMode>(request.TeachingArrangement.TeachingMode, true, out var requestedMode); enrollment.TeachingMode = requestedMode; enrollment.DefaultClassDurationMinutes = request.TeachingArrangement.DefaultClassDurationMinutes; }
            if (request.Availability is not null)
            {
                database.StudentAvailabilities.RemoveRange(enrollment.Availability);
                enrollment.Availability.Clear();
                foreach (var item in request.Availability) enrollment.Availability.Add(new StudentAvailability { Id = Guid.NewGuid(), StudentEnrollmentId = enrollment.Id, Enrollment = enrollment, DayOfWeek = Enum.Parse<DayOfWeek>(item.DayOfWeek, true), StartLocalTime = item.StartLocalTime, EndLocalTime = item.EndLocalTime, TimeZoneId = student.TimeZoneId ?? "UTC" });
            }
        }
        student.UpdatedAt = DateTimeOffset.UtcNow;
        await database.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return await GetStudentAsync(teacherId, id, cancellationToken);
    }

    public async Task<StudentDto?> UpdateStudentStatusAsync(Guid teacherId, Guid id, bool isActive, CancellationToken cancellationToken)
    {
        var student = await database.Students.SingleOrDefaultAsync(
            x => x.Id == id && x.TeacherId == teacherId, cancellationToken);
        if (student is null) return null;

        student.Status = isActive ? StudentStatus.Active : StudentStatus.Inactive;
        student.UpdatedAt = DateTimeOffset.UtcNow;
        await database.SaveChangesAsync(cancellationToken);
        return ToDto(student);
    }

    private static string? NormalizeOptional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static void ValidateUpdate(UpdateStudentDto request, Student student)
    {
        if (request.FullName.Trim().Length < 2) throw new ValidationException("Student name must contain at least 2 characters.");
        if (!string.IsNullOrWhiteSpace(request.Email) && !new EmailAddressAttribute().IsValid(request.Email.Trim())) throw new ValidationException("Enter a valid student email address.");
        if (request.DateOfBirth is { } dob && dob > DateOnly.FromDateTime(DateTime.UtcNow)) throw new ValidationException("Date of birth cannot be in the future.");
        if (request.TimeZoneId is not null && !IsIanaTimeZone(request.TimeZoneId)) throw new ValidationException("Select a valid IANA timezone identifier.");
        if (request.Guardian is { } guardian && (string.IsNullOrWhiteSpace(guardian.FullName) || guardian.FullName.Trim().Length is < 2 or > 100 || string.IsNullOrWhiteSpace(guardian.Email) || guardian.Email.Trim().Length > 254 || !new EmailAddressAttribute().IsValid(guardian.Email) || !new[] { "Mother", "Father", "Guardian", "Other" }.Contains(guardian.Relationship, StringComparer.OrdinalIgnoreCase))) throw new ValidationException("Enter valid guardian details.");
        if (request.Subjects is { Count: > 30 } || request.Subjects?.Any(x => string.IsNullOrWhiteSpace(x) || x.Trim().Length > 100) == true) throw new ValidationException("Select up to 30 valid subjects.");
        if (request.AdditionalLanguages?.Any(x => string.IsNullOrWhiteSpace(x) || x.Trim().Length > 100) == true) throw new ValidationException("Additional language names must be at most 100 characters.");
        if (request.TeachingArrangement is { } arrangement && (!Enum.TryParse<TeachingMode>(arrangement.TeachingMode, true, out _) || arrangement.DefaultClassDurationMinutes is not (30 or 45 or 60 or 90))) throw new ValidationException("Choose a valid teaching mode and class duration.");
        if (request.Availability is { Count: > 28 } || request.Availability?.Any(x => !Enum.TryParse<DayOfWeek>(x.DayOfWeek, true, out _) || x.EndLocalTime <= x.StartLocalTime) == true) throw new ValidationException("Each availability window needs a valid day and an end time after its start time.");
    }

    private static bool IsIanaTimeZone(string value)
    {
        try { return TimeZoneInfo.TryConvertIanaIdToWindowsId(value.Trim(), out _) && TimeZoneInfo.FindSystemTimeZoneById(value.Trim()) is not null; }
        catch (TimeZoneNotFoundException) { return false; }
        catch (InvalidTimeZoneException) { return false; }
    }

    private static StudentDto ToDto(Student student) => new(
        student.Id,
        student.FullName,
        student.Email,
        student.PhoneNumber,
        student.Status.ToString(),
        student.Notes,
        student.CreatedAt,
        student.UpdatedAt,
        student.PreferredName, student.DateOfBirth, student.GradeOrYear, student.Country, student.StateOrProvince, student.City,
        student.TimeZoneId, student.PreferredTeachingLanguage, student.LearningNotes,
        student.Guardians?.Select(x => new GuardianDto(x.FullName, x.Relationship, x.Email, x.PhoneNumber, x.IsPrimary)).ToList(),
        student.Subjects?.Select(x => x.Subject.Name).OrderBy(x => x).ToList(),
        student.AdditionalLanguages?.Select(x => x.Language).OrderBy(x => x).ToList(),
        student.Enrollments?.OrderByDescending(x => x.CreatedAt).Select(x => new TeachingArrangementDto(x.TeachingMode.ToString(), x.DefaultClassDurationMinutes, x.Status.ToString())).FirstOrDefault(),
        student.Enrollments?.SelectMany(x => x.Availability).Select(x => new StudentAvailabilityDto(x.DayOfWeek.ToString(), x.StartLocalTime, x.EndLocalTime, x.TimeZoneId)).ToList());
}

using Microsoft.EntityFrameworkCore;
using StudentManagement.Api.Entities;

namespace StudentManagement.Api.Data;

public sealed class AuthDbContext(DbContextOptions<AuthDbContext> options) : DbContext(options)
{
    public DbSet<AppUser> AppUsers => Set<AppUser>();
    public DbSet<EmailOtp> EmailOtps => Set<EmailOtp>();
    public DbSet<Student> Students => Set<Student>();
    public DbSet<StudentGuardian> StudentGuardians => Set<StudentGuardian>();
    public DbSet<Subject> Subjects => Set<Subject>();
    public DbSet<StudentSubject> StudentSubjects => Set<StudentSubject>();
    public DbSet<StudentLanguage> StudentLanguages => Set<StudentLanguage>();
    public DbSet<StudentEnrollment> StudentEnrollments => Set<StudentEnrollment>();
    public DbSet<StudentAvailability> StudentAvailabilities => Set<StudentAvailability>();
    public DbSet<ClassSchedule> ClassSchedules => Set<ClassSchedule>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var users = modelBuilder.Entity<AppUser>();
        users.ToTable("AppUsers");
        users.HasKey(x => x.Id);
        users.Property(x => x.FullName).HasMaxLength(100).IsRequired();
        users.Property(x => x.Email).HasMaxLength(254).IsRequired();
        users.Property(x => x.NormalizedEmail).HasMaxLength(254).IsRequired();
        users.HasIndex(x => x.NormalizedEmail).IsUnique();
        users.Property(x => x.PasswordHash).HasMaxLength(512).IsRequired();
        users.Property(x => x.Role).HasConversion<string>().HasMaxLength(32).IsRequired();

        var pending = modelBuilder.Entity<EmailOtp>();
        pending.ToTable("PendingTeacherRegistrations");
        pending.HasKey(x => x.Id);
        pending.Property(x => x.RegistrationReferenceHash).HasMaxLength(64).IsRequired();
        pending.HasIndex(x => x.RegistrationReferenceHash).IsUnique();
        pending.Property(x => x.LastOtpSentAt).IsConcurrencyToken();
        pending.Property(x => x.FullName).HasMaxLength(100).IsRequired();
        pending.Property(x => x.Email).HasMaxLength(254).IsRequired();
        pending.Property(x => x.NormalizedEmail).HasMaxLength(254).IsRequired();
        pending.HasIndex(x => x.NormalizedEmail).IsUnique();
        pending.Property(x => x.PasswordHash).HasMaxLength(512).IsRequired();
        pending.Property(x => x.OtpHash).HasColumnType("bytea").IsRequired();

        var students = modelBuilder.Entity<Student>();
        students.ToTable("Students");
        students.HasKey(x => x.Id);
        students.Property(x => x.FullName).HasMaxLength(100).IsRequired();
        students.Property(x => x.PreferredName).HasMaxLength(100);
        students.Property(x => x.GradeOrYear).HasMaxLength(100);
        students.Property(x => x.Email).HasMaxLength(254);
        students.Property(x => x.PhoneNumber).HasMaxLength(30);
        students.Property(x => x.Country).HasMaxLength(100);
        students.Property(x => x.StateOrProvince).HasMaxLength(100);
        students.Property(x => x.City).HasMaxLength(100);
        students.Property(x => x.TimeZoneId).HasMaxLength(100);
        students.Property(x => x.PreferredTeachingLanguage).HasMaxLength(100);
        students.Property(x => x.Status).HasConversion<string>().HasMaxLength(16).IsRequired();
        students.Property(x => x.Notes).HasMaxLength(2000);
        students.Property(x => x.LearningNotes).HasMaxLength(2000);
        students.HasIndex(x => x.TeacherId);
        students.HasOne<AppUser>()
            .WithMany()
            .HasForeignKey(x => x.TeacherId)
            .OnDelete(DeleteBehavior.Restrict);

        var guardians = modelBuilder.Entity<StudentGuardian>();
        guardians.ToTable("StudentGuardians");
        guardians.HasKey(x => x.Id);
        guardians.Property(x => x.FullName).HasMaxLength(100).IsRequired();
        guardians.Property(x => x.Relationship).HasMaxLength(20).IsRequired();
        guardians.Property(x => x.Email).HasMaxLength(254).IsRequired();
        guardians.Property(x => x.PhoneNumber).HasMaxLength(30);
        guardians.HasIndex(x => x.StudentId);
        guardians.HasOne(x => x.Student).WithMany(x => x.Guardians).HasForeignKey(x => x.StudentId).OnDelete(DeleteBehavior.Cascade);

        var subjects = modelBuilder.Entity<Subject>();
        subjects.ToTable("Subjects");
        subjects.HasKey(x => x.Id);
        subjects.Property(x => x.Name).HasMaxLength(100).IsRequired();
        subjects.Property(x => x.NormalizedName).HasMaxLength(100).IsRequired();
        subjects.HasIndex(x => x.NormalizedName).IsUnique();

        var studentSubjects = modelBuilder.Entity<StudentSubject>();
        studentSubjects.ToTable("StudentSubjects");
        studentSubjects.HasKey(x => new { x.StudentId, x.SubjectId });
        studentSubjects.HasOne(x => x.Student).WithMany(x => x.Subjects).HasForeignKey(x => x.StudentId).OnDelete(DeleteBehavior.Cascade);
        studentSubjects.HasOne(x => x.Subject).WithMany(x => x.Students).HasForeignKey(x => x.SubjectId).OnDelete(DeleteBehavior.Restrict);

        var languages = modelBuilder.Entity<StudentLanguage>();
        languages.ToTable("StudentLanguages");
        languages.HasKey(x => new { x.StudentId, x.Language });
        languages.Property(x => x.Language).HasMaxLength(100).IsRequired();
        languages.HasOne(x => x.Student).WithMany(x => x.AdditionalLanguages).HasForeignKey(x => x.StudentId).OnDelete(DeleteBehavior.Cascade);

        var enrollments = modelBuilder.Entity<StudentEnrollment>();
        enrollments.ToTable("StudentEnrollments");
        enrollments.HasKey(x => x.Id);
        enrollments.Property(x => x.TeachingMode).HasConversion<string>().HasMaxLength(20).IsRequired();
        enrollments.Property(x => x.Status).HasConversion<string>().HasMaxLength(16).IsRequired();
        enrollments.HasIndex(x => x.StudentId);
        enrollments.HasOne(x => x.Student).WithMany(x => x.Enrollments).HasForeignKey(x => x.StudentId).OnDelete(DeleteBehavior.Cascade);

        var availability = modelBuilder.Entity<StudentAvailability>();
        availability.ToTable("StudentAvailabilities");
        availability.HasKey(x => x.Id);
        availability.Property(x => x.DayOfWeek).HasConversion<string>().HasMaxLength(16).IsRequired();
        availability.Property(x => x.StartLocalTime).HasColumnType("time without time zone").IsRequired();
        availability.Property(x => x.EndLocalTime).HasColumnType("time without time zone").IsRequired();
        availability.Property(x => x.TimeZoneId).HasMaxLength(100).IsRequired();
        availability.HasIndex(x => x.StudentEnrollmentId);
        availability.HasOne(x => x.Enrollment).WithMany(x => x.Availability).HasForeignKey(x => x.StudentEnrollmentId).OnDelete(DeleteBehavior.Cascade);

        var schedules = modelBuilder.Entity<ClassSchedule>();
        schedules.ToTable("ClassSchedules");
        schedules.HasKey(x => x.Id);
        schedules.Property(x => x.TeacherTimeZoneId).HasMaxLength(100).IsRequired();
        schedules.Property(x => x.StudentTimeZoneId).HasMaxLength(100).IsRequired();
        schedules.Property(x => x.Description).HasMaxLength(500);
        schedules.Property(x => x.Status).HasConversion<string>().HasMaxLength(16).IsRequired();
        schedules.HasOne<AppUser>().WithMany().HasForeignKey(x => x.TeacherId).OnDelete(DeleteBehavior.Restrict);
        schedules.HasOne(x => x.Student).WithMany().HasForeignKey(x => x.StudentId).OnDelete(DeleteBehavior.Restrict);
        schedules.HasIndex(x => new { x.StudentId, x.Status, x.StartDateTimeUtc, x.EndDateTimeUtc });
        schedules.HasIndex(x => new { x.TeacherId, x.StartDateTimeUtc });
    }
}

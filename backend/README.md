# Student Management auth API

This API keeps teacher registrations pending until the email OTP has been checked. It never returns or logs the OTP or password. Do not apply the initial migration to a database until the target database/schema has been reviewed.

## Local configuration

Set these in the process environment or .NET User Secrets; do not commit credentials:

- `ConnectionStrings__DefaultConnection`: PostgreSQL connection string.
- `Otp__HmacKey`: at least 32 random bytes encoded as text. Generate with PowerShell: `[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))`.
- `Jwt__SigningKey`: at least 32 random bytes encoded as text. Keep it private and stable across restarts; rotating it invalidates active sessions. JWT issuer, audience, and expiry are set in `appsettings.json` and may be overridden with `Jwt__Issuer`, `Jwt__Audience`, and `Jwt__ExpiryMinutes`.
- `Email__SmtpHost`, `Email__SmtpPort`, `Email__FromAddress`, `Email__FromName`, `Email__UseSsl`.
- `Email__SmtpUsername` and `Email__SmtpPassword` when the relay requires authentication.

If any required service configuration is missing, registration returns a configuration error and does not create an account or claim that a message was delivered.

## API contract

- `POST /api/auth/register` with `{ fullName, email, password }` returns `202` and `{ registrationReference, email, resendCooldownSeconds }` only after SMTP accepts the message.
- `POST /api/auth/verify-otp` with `{ registrationReference, otp }` returns `{ verified, message }`. The Teacher record is created in the same database transaction that removes the pending record.
- `POST /api/auth/resend-otp` with `{ registrationReference }` returns `{ resendCooldownSeconds }` only after SMTP accepts the new message.
- `POST /api/auth/login` with `{ email, password }` returns `{ accessToken, expiresAt, user: { id, email, fullName, role } }` for a verified account. Passwords are checked using ASP.NET Core's password hasher; unknown email and incorrect password share a generic 401 response.
- `GET /api/auth/me` requires a valid bearer token and returns the identity claims for that session.
- `GET /api/students?search=&page=1&pageSize=20&isActive=true` lists only the authenticated teacher's students and includes total/active/inactive counts. `isActive` is optional.
- `GET /api/students/{id}` returns one owned student; other teachers' students are returned as 404.
- `POST /api/students` accepts `{ fullName, email?, phoneNumber?, notes? }` and creates an active student owned by the authenticated teacher.
- `PUT /api/students/{id}` updates `{ fullName, email?, phoneNumber?, notes? }` for an owned student.
- `PATCH /api/students/{id}/status` accepts `{ isActive }` to activate or deactivate an owned student.

All `/api/students` endpoints require a valid bearer token with the `Teacher` role. The API derives `TeacherId` from the validated token; request bodies cannot set it.

The frontend keeps the access token and minimal user information in `sessionStorage`. This storage is accessible to JavaScript in the page and does not protect against cross-site scripting (XSS); use a strong Content Security Policy and prevent unsafe script injection.

The Angular development client uses `http://localhost:5173`; configure `Cors__AllowedOrigins` when using another origin. Run `dotnet ef database update` only after confirming the configured PostgreSQL database is the intended target.

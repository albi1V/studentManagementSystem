export interface TeacherRegistration { fullName: string; email: string; password: string; }
export interface OtpRegistrationResponse { registrationReference: string; email: string; resendCooldownSeconds: number; }
export interface VerifyOtpRequest { registrationReference: string; otp: string; }
export interface ResendOtpRequest { registrationReference: string; }
export interface ResendOtpResponse { resendCooldownSeconds: number; }
export interface OtpVerificationResponse { message: string; verified: true; }
export interface LoginCredentials { email: string; password: string; }
export interface AuthenticatedUser { id: string; email: string; fullName: string; role: string; }
export interface LoginResponse { accessToken: string; expiresAt: string; user: AuthenticatedUser; }
export interface TeacherLoginCredentials { email: string; }
export interface OtpVerification { email: string; }
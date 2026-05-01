export interface BaseMailJob {
  to: string;
}

export interface OtpMailJob extends BaseMailJob {
  otp: string;
  name?: string;
}

export interface WelcomeMailJob extends BaseMailJob {
  name?: string;
}

export interface VerificationMailJob extends BaseMailJob {
  verificationLink: string;
  name?: string;
}

export interface ForgotPasswordMailJob extends BaseMailJob {
  otp: string;
  resetLink: string;
  name?: string;
}

// Sum type for the queue
export type MailJobData =
  | ({ type: 'otp' } & OtpMailJob)
  | ({ type: 'welcome' } & WelcomeMailJob)
  | ({ type: 'verification' } & VerificationMailJob)
  | ({ type: 'forgot-password' } & ForgotPasswordMailJob)
  | ({ type: 'admin-forgot-password' } & ForgotPasswordMailJob);

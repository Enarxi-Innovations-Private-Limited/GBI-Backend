/**
 * Email Provider Interface
 * Implement this interface for any email provider (Mock, AWS SES, SendGrid, etc.)
 */
export interface IEmailProvider {
  /**
   * Send email to recipient
   */
  sendEmail(params: {
    to: string;
    subject: string;
    body: string;
    html?: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }>;

  /**
   * Send OTP email
   */
  sendOTP(params: {
    to: string;
    otp: string;
    name?: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }>;

  /**
   * Send verification email
   */
  sendVerificationEmail(params: {
    to: string;
    verificationLink: string;
    name?: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }>;
}

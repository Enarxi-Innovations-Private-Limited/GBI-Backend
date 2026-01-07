/**
 * SMS Provider Interface
 * Implement this interface for any SMS provider (Mock, AWS SNS, Twilio, etc.)
 */
export interface ISmsProvider {
  /**
   * Send SMS to phone number
   */
  sendSms(params: {
    to: string;
    message: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }>;

  /**
   * Send OTP via SMS
   */
  sendOTP(params: {
    to: string;
    otp: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }>;
}

export interface EmailService {
  sendPasswordResetEmail(to: string, name: string, resetUrl: string): Promise<void>;
  sendEmailVerificationEmail(to: string, name: string, verifyUrl: string): Promise<void>;
  sendPasswordChangedAlertEmail(to: string, name: string): Promise<void>;
}

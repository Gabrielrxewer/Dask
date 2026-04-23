export interface EmailService {
  sendPasswordResetEmail(to: string, name: string, resetUrl: string): Promise<void>;
  sendEmailVerificationEmail(to: string, name: string, verifyUrl: string): Promise<void>;
  sendPasswordChangedAlertEmail(to: string, name: string): Promise<void>;
  sendWorkspaceInviteEmail(
    to: string,
    input: {
      workspaceName: string;
      inviterName: string;
      inviteUrl: string;
      role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
    }
  ): Promise<void>;
  sendCheckoutLinkEmail(
    to: string,
    input: {
      workspaceName: string;
      description: string;
      amount: string;
      checkoutUrl: string;
    }
  ): Promise<void>;
  sendPaymentReminderEmail(
    to: string,
    input: {
      workspaceName: string;
      description: string;
      amount: string;
      checkoutUrl: string;
    }
  ): Promise<void>;
}

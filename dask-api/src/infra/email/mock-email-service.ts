import { logger } from '@/core/logging/logger';
import type { EmailService } from '@/infra/email/email-service';

export class MockEmailService implements EmailService {
  public async sendPasswordResetEmail(to: string, name: string, resetUrl: string): Promise<void> {
    this.log('email.password_reset.mocked', { to, name, resetUrl });
  }

  public async sendEmailVerificationEmail(to: string, name: string, verifyUrl: string): Promise<void> {
    this.log('email.verification.mocked', { to, name, verifyUrl });
  }

  public async sendPasswordChangedAlertEmail(to: string, name: string): Promise<void> {
    this.log('email.password_changed_alert.mocked', { to, name });
  }

  public async sendWorkspaceInviteEmail(
    to: string,
    input: {
      workspaceName: string;
      inviterName: string;
      inviteUrl: string;
      role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' | 'CLIENT';
    }
  ): Promise<void> {
    this.log('email.workspace_invite.mocked', { to, ...input });
  }

  public async sendCommercialDocumentEmail(
    to: string,
    input: {
      workspaceName: string;
      documentTitle: string;
      documentType: 'proposal' | 'contract';
      publicUrl: string;
    }
  ): Promise<void> {
    this.log('email.commercial_document.mocked', { to, ...input });
  }

  public async sendCheckoutLinkEmail(
    to: string,
    input: {
      workspaceName: string;
      description: string;
      amount: string;
      checkoutUrl: string;
    }
  ): Promise<void> {
    this.log('email.checkout_link.mocked', { to, ...input });
  }

  public async sendPaymentReminderEmail(
    to: string,
    input: {
      workspaceName: string;
      description: string;
      amount: string;
      checkoutUrl: string;
    }
  ): Promise<void> {
    this.log('email.payment_reminder.mocked', { to, ...input });
  }

  private log(event: string, payload: Record<string, unknown>): void {
    logger.info({ event, ...payload });
  }
}

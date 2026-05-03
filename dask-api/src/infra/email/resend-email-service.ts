import { Resend } from 'resend';
import { env } from '@/core/config/env';
import { logger } from '@/core/logging/logger';
import type { EmailService } from '@/infra/email/email-service';
import {
  checkoutLinkTemplate,
  commercialDocumentTemplate,
  emailVerificationTemplate,
  passwordChangedAlertTemplate,
  passwordResetTemplate,
  paymentReminderTemplate,
  workspaceInviteTemplate
} from '@/infra/email/email-templates';

export class ResendEmailService implements EmailService {
  private readonly client: Resend;

  public constructor() {
    this.client = new Resend(env.RESEND_API_KEY);
  }

  public async sendPasswordResetEmail(to: string, name: string, resetUrl: string): Promise<void> {
    const { html, text } = passwordResetTemplate(name, resetUrl);

    const { error } = await this.client.emails.send({
      from: env.EMAIL_FROM,
      to,
      subject: 'Redefinição de senha — Dask',
      html,
      text
    });

    if (error) {
      logger.error({ event: 'email.password_reset.failed', to, error });
      throw new Error(`Failed to send password reset email: ${error.message}`);
    }

    logger.info({ event: 'email.password_reset.sent', to });
  }

  public async sendPasswordChangedAlertEmail(to: string, name: string): Promise<void> {
    const { html, text } = passwordChangedAlertTemplate(name);

    const { error } = await this.client.emails.send({
      from: env.EMAIL_FROM,
      to,
      subject: 'Sua senha foi alterada — Dask',
      html,
      text
    });

    if (error) {
      logger.error({ event: 'email.password_changed_alert.failed', to, error });
    } else {
      logger.info({ event: 'email.password_changed_alert.sent', to });
    }
  }

  public async sendEmailVerificationEmail(to: string, name: string, verifyUrl: string): Promise<void> {
    const { html, text } = emailVerificationTemplate(name, verifyUrl);

    const { error } = await this.client.emails.send({
      from: env.EMAIL_FROM,
      to,
      subject: 'Confirme seu e-mail — Dask',
      html,
      text
    });

    if (error) {
      logger.error({ event: 'email.verification.failed', to, error });
      throw new Error(`Failed to send verification email: ${error.message}`);
    }

    logger.info({ event: 'email.verification.sent', to });
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
    const { html, text } = workspaceInviteTemplate(input);

    const { error } = await this.client.emails.send({
      from: env.EMAIL_FROM,
      to,
      subject: `Convite para ${input.workspaceName} — Dask`,
      html,
      text
    });

    if (error) {
      logger.error({ event: 'email.workspace_invite.failed', to, error });
      throw new Error(`Failed to send workspace invite email: ${error.message}`);
    }

    logger.info({ event: 'email.workspace_invite.sent', to });
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
    const { html, text } = commercialDocumentTemplate(input);
    const documentLabel = input.documentType === 'proposal' ? 'Proposta' : 'Contrato';

    const { error } = await this.client.emails.send({
      from: env.EMAIL_FROM,
      to,
      subject: `${documentLabel}: ${input.documentTitle} - ${input.workspaceName}`,
      html,
      text
    });

    if (error) {
      logger.error({ event: 'email.commercial_document.failed', to, error });
      throw new Error(`Failed to send commercial document email: ${error.message}`);
    }

    logger.info({ event: 'email.commercial_document.sent', to, documentType: input.documentType });
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
    const { html, text } = checkoutLinkTemplate(input);

    const { error } = await this.client.emails.send({
      from: env.EMAIL_FROM,
      to,
      subject: `Cobrança de ${input.workspaceName} — ${input.amount}`,
      html,
      text
    });

    if (error) {
      logger.error({ event: 'email.checkout_link.failed', to, error });
    } else {
      logger.info({ event: 'email.checkout_link.sent', to });
    }
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
    const { html, text } = paymentReminderTemplate(input);

    const { error } = await this.client.emails.send({
      from: env.EMAIL_FROM,
      to,
      subject: `Lembre-se de pagar — ${input.workspaceName}`,
      html,
      text
    });

    if (error) {
      logger.error({ event: 'email.payment_reminder.failed', to, error });
    } else {
      logger.info({ event: 'email.payment_reminder.sent', to });
    }
  }
}

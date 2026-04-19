import { Resend } from 'resend';
import { env } from '@/core/config/env';
import type {
  MarketingEmailProvider,
  MarketingEmailSendInput,
  MarketingEmailSendResult
} from '@/modules/marketing/providers/marketing-email-provider';

export class ResendMarketingEmailProvider implements MarketingEmailProvider {
  public readonly key = 'resend';
  private readonly client: Resend;

  public constructor() {
    this.client = new Resend(env.RESEND_API_KEY);
  }

  public async sendEmail(input: MarketingEmailSendInput): Promise<MarketingEmailSendResult> {
    const { data, error } = await this.client.emails.send({
      from: input.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo,
      headers: input.metadata
        ? {
            'X-Dask-Metadata': JSON.stringify(input.metadata)
          }
        : undefined
    });

    if (error) {
      throw new Error(`Resend send failed: ${error.message}`);
    }

    return {
      messageId: data?.id ?? '',
      providerKey: this.key
    };
  }
}

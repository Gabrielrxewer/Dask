import crypto from 'crypto';
import type {
  MarketingEmailProvider,
  MarketingEmailSendInput,
  MarketingEmailSendResult
} from '@/modules/marketing/providers/marketing-email-provider';

export class MockMarketingEmailProvider implements MarketingEmailProvider {
  public readonly key = 'mock';

  public async sendEmail(_input: MarketingEmailSendInput): Promise<MarketingEmailSendResult> {
    return {
      messageId: `mock_${crypto.randomUUID()}`,
      providerKey: this.key
    };
  }
}

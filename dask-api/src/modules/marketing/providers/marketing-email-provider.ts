export type MarketingEmailSendInput = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  metadata?: Record<string, unknown>;
};

export type MarketingEmailSendResult = {
  messageId: string;
  providerKey: string;
};

export interface MarketingEmailProvider {
  readonly key: string;
  sendEmail(input: MarketingEmailSendInput): Promise<MarketingEmailSendResult>;
}

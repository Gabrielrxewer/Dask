export type CommunicationChannel = 'email' | 'whatsapp';

export type CommunicationSendInput = {
  workspaceId: string;
  runId: string;
  stepRunId: string;
  channel: CommunicationChannel;
  to: string;
  from?: string;
  replyTo?: string;
  subject?: string;
  body: string;
  text?: string;
  html?: string;
  providerTemplateName?: string;
  providerTemplateId?: string;
  providerTemplateParameters?: string[];
  language?: string;
  metadata?: Record<string, unknown>;
};

export type CommunicationSendResult = {
  provider?: string;
  providerMessageId: string;
  status: 'sent' | 'mock_sent';
  sentAt?: string;
  raw?: Record<string, unknown>;
};

export interface CommunicationProvider {
  channel: CommunicationChannel;
  provider: string;
  send(input: CommunicationSendInput): Promise<CommunicationSendResult>;
}

export class CommunicationProviderError extends Error {
  public readonly code: string;
  public readonly retryable: boolean;
  public readonly details?: Record<string, unknown>;

  public constructor(input: {
    message: string;
    code?: string;
    retryable?: boolean;
    details?: Record<string, unknown>;
  }) {
    super(input.message);
    this.name = 'CommunicationProviderError';
    this.code = input.code ?? 'COMMUNICATION_PROVIDER_ERROR';
    this.retryable = input.retryable ?? false;
    this.details = input.details;
  }
}

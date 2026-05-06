import { randomUUID } from 'crypto';
import {
  CommunicationProviderError,
  type CommunicationProvider,
  type CommunicationSendInput,
  type CommunicationSendResult
} from '@/modules/automation/communication/communication-provider';

function readSimulation(metadata: Record<string, unknown> | undefined): {
  shouldFail: boolean;
  retryable: boolean;
} {
  const simulate = metadata?.simulateProviderError;
  if (simulate === 'retryable') {
    return { shouldFail: true, retryable: true };
  }
  if (simulate === 'permanent' || simulate === 'non_retryable') {
    return { shouldFail: true, retryable: false };
  }

  return {
    shouldFail: metadata?.mockShouldFail === true,
    retryable: metadata?.mockRetryable !== false
  };
}

export class MockEmailProvider implements CommunicationProvider {
  public readonly channel = 'email' as const;
  public readonly provider = 'mock';

  public async send(input: CommunicationSendInput): Promise<CommunicationSendResult> {
    const simulation = readSimulation(input.metadata);
    if (simulation.shouldFail) {
      throw new CommunicationProviderError({
        message: 'Mock email provider simulated a failure.',
        code: 'MOCK_EMAIL_PROVIDER_FAILURE',
        retryable: simulation.retryable,
        details: {
          channel: input.channel,
          to: input.to
        }
      });
    }

    return {
      providerMessageId: `mock_email_${randomUUID()}`,
      status: 'mock_sent',
      raw: {
        channel: input.channel,
        provider: this.provider,
        to: input.to,
        subject: input.subject ?? null,
        bodyLength: input.body.length
      }
    };
  }
}

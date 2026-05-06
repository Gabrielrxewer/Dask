import { env } from '@/core/config/env';
import { CommunicationProviderRegistry } from '@/modules/automation/communication/communication-provider-registry';
import { MockEmailProvider } from '@/modules/automation/communication/mock-email-provider';
import { MockWhatsAppProvider } from '@/modules/automation/communication/mock-whatsapp-provider';
import { ResendCommunicationEmailProvider } from '@/modules/automation/communication/resend-communication-email-provider';

export function createDefaultCommunicationProviderRegistry(input?: {
  emailSendMode?: 'mock' | 'real';
  emailProvider?: 'mock' | 'resend';
  resendApiKey?: string;
  resendDefaultFrom?: string;
  resendReplyTo?: string;
}): CommunicationProviderRegistry {
  const registry = new CommunicationProviderRegistry();
  registry.register(new MockEmailProvider());
  registry.register(new MockWhatsAppProvider());

  const emailSendMode = input?.emailSendMode ?? env.AUTOMATION_EMAIL_SEND_MODE;
  const emailProvider = input?.emailProvider ?? env.AUTOMATION_EMAIL_PROVIDER;
  if (emailSendMode === 'real' && emailProvider === 'resend') {
    registry.register(new ResendCommunicationEmailProvider({
      apiKey: input?.resendApiKey ?? env.RESEND_API_KEY,
      defaultFrom: input?.resendDefaultFrom ?? env.RESEND_DEFAULT_FROM ?? env.EMAIL_FROM,
      defaultReplyTo: input?.resendReplyTo ?? env.RESEND_REPLY_TO
    }));
  }

  return registry;
}

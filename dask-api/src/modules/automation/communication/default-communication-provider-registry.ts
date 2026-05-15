import { env } from '@/core/config/env';
import { CommunicationProviderRegistry } from '@/modules/automation/communication/communication-provider-registry';
import { MetaWhatsAppProvider } from '@/modules/automation/communication/meta-whatsapp-provider';
import { MockEmailProvider } from '@/modules/automation/communication/mock-email-provider';
import { MockWhatsAppProvider } from '@/modules/automation/communication/mock-whatsapp-provider';
import { ResendCommunicationEmailProvider } from '@/modules/automation/communication/resend-communication-email-provider';

export function createDefaultCommunicationProviderRegistry(input?: {
  emailSendMode?: 'mock' | 'real';
  emailProvider?: 'mock' | 'resend';
  whatsappSendMode?: 'mock' | 'real';
  whatsappProvider?: 'mock' | 'meta';
  resendApiKey?: string;
  resendDefaultFrom?: string;
  resendReplyTo?: string;
  metaWhatsAppAccessToken?: string;
  metaWhatsAppPhoneNumberId?: string;
  metaWhatsAppGraphApiVersion?: string;
  metaWhatsAppCredentialResolver?: (input: { workspaceId: string }) => Promise<{
    accessToken: string;
    phoneNumberId: string;
    graphApiVersion?: string;
  } | null>;
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

  const whatsappSendMode = input?.whatsappSendMode ?? env.AUTOMATION_WHATSAPP_SEND_MODE;
  const whatsappProvider = input?.whatsappProvider ?? env.AUTOMATION_WHATSAPP_PROVIDER;
  if ((whatsappSendMode === 'real' && whatsappProvider === 'meta') || input?.metaWhatsAppCredentialResolver) {
    registry.register(new MetaWhatsAppProvider({
      accessToken: input?.metaWhatsAppAccessToken ?? env.META_WHATSAPP_ACCESS_TOKEN,
      phoneNumberId: input?.metaWhatsAppPhoneNumberId ?? env.META_WHATSAPP_PHONE_NUMBER_ID,
      graphApiVersion: input?.metaWhatsAppGraphApiVersion ?? env.META_WHATSAPP_GRAPH_API_VERSION,
      credentialResolver: input?.metaWhatsAppCredentialResolver
    }));
  }

  return registry;
}

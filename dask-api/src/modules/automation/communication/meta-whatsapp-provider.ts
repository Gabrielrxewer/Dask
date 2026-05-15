import {
  CommunicationProviderError,
  type CommunicationProvider,
  type CommunicationSendInput,
  type CommunicationSendResult
} from '@/modules/automation/communication/communication-provider';

type MetaWhatsAppFetch = (
  url: string,
  init: {
    method: 'POST';
    headers: Record<string, string>;
    body: string;
  }
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

type MetaWhatsAppProviderOptions = {
  accessToken?: string;
  phoneNumberId?: string;
  graphApiVersion?: string;
  fetch?: MetaWhatsAppFetch;
  credentialResolver?: (input: { workspaceId: string }) => Promise<{
    accessToken: string;
    phoneNumberId: string;
    graphApiVersion?: string;
  } | null>;
};

const retryableStatusCodes = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function normalizeGraphApiVersion(value: string | undefined): string {
  const version = value?.trim() || 'v23.0';
  return version.startsWith('v') ? version : `v${version}`;
}

function normalizeWhatsAppRecipient(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) {
    throw new CommunicationProviderError({
      message: 'Invalid WhatsApp recipient.',
      code: 'INVALID_WHATSAPP_RECIPIENT',
      retryable: false
    });
  }

  return digits;
}

function readMetaError(payload: unknown): {
  message: string;
  code?: string;
  type?: string;
  fbtraceId?: string;
} {
  const error = isRecord(payload) && isRecord(payload.error) ? payload.error : {};
  return {
    message: readString(error.message) ?? 'Meta WhatsApp message send failed.',
    code: readString(error.code) ?? undefined,
    type: readString(error.type) ?? undefined,
    fbtraceId: readString(error.fbtrace_id) ?? undefined
  };
}

function buildTextPayload(input: CommunicationSendInput, to: string): Record<string, unknown> {
  const body = readString(input.text) ?? readString(input.body);
  if (!body) {
    throw new CommunicationProviderError({
      message: 'WhatsApp message body is required.',
      code: 'WHATSAPP_BODY_REQUIRED',
      retryable: false
    });
  }

  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: {
      preview_url: false,
      body
    }
  };
}

function buildTemplatePayload(input: CommunicationSendInput, to: string): Record<string, unknown> | null {
  const templateName = readString(input.providerTemplateName);
  if (!templateName) {
    return null;
  }

  const parameters = Array.isArray(input.providerTemplateParameters)
    ? input.providerTemplateParameters
        .map((value) => readString(value))
        .filter((value): value is string => Boolean(value))
    : [];

  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: {
        code: readString(input.language) ?? 'pt_BR'
      },
      ...(parameters.length > 0
        ? {
            components: [
              {
                type: 'body',
                parameters: parameters.map((text) => ({ type: 'text', text }))
              }
            ]
          }
        : {})
    }
  };
}

function extractProviderMessageId(payload: unknown): string | null {
  if (!isRecord(payload) || !Array.isArray(payload.messages)) {
    return null;
  }

  const first = payload.messages[0];
  return isRecord(first) ? readString(first.id) : null;
}

export class MetaWhatsAppProvider implements CommunicationProvider {
  public readonly channel = 'whatsapp' as const;
  public readonly provider = 'meta';
  private readonly fetchImpl: MetaWhatsAppFetch;
  private readonly graphApiVersion: string;

  public constructor(private readonly options: MetaWhatsAppProviderOptions) {
    if (!options.accessToken && !options.credentialResolver) {
      throw new CommunicationProviderError({
        message: 'META_WHATSAPP_ACCESS_TOKEN is required for automation WhatsApp send mode "real".',
        code: 'META_WHATSAPP_ACCESS_TOKEN_MISSING',
        retryable: false
      });
    }
    if (!options.phoneNumberId && !options.credentialResolver) {
      throw new CommunicationProviderError({
        message: 'META_WHATSAPP_PHONE_NUMBER_ID is required for automation WhatsApp send mode "real".',
        code: 'META_WHATSAPP_PHONE_NUMBER_ID_MISSING',
        retryable: false
      });
    }

    this.graphApiVersion = normalizeGraphApiVersion(options.graphApiVersion);
    this.fetchImpl = options.fetch ?? fetch;
  }

  public async send(input: CommunicationSendInput): Promise<CommunicationSendResult> {
    if (input.channel !== 'whatsapp') {
      throw new CommunicationProviderError({
        message: 'Meta provider only supports WhatsApp channel.',
        code: 'META_WHATSAPP_UNSUPPORTED_CHANNEL',
        retryable: false
      });
    }

    const to = normalizeWhatsAppRecipient(input.to);
    const credentials = this.options.credentialResolver
      ? await this.options.credentialResolver({ workspaceId: input.workspaceId })
      : {
          accessToken: this.options.accessToken ?? '',
          phoneNumberId: this.options.phoneNumberId ?? '',
          graphApiVersion: this.graphApiVersion
        };
    if (!credentials?.accessToken || !credentials.phoneNumberId) {
      throw new CommunicationProviderError({
        message: 'Meta WhatsApp integration is not configured for this workspace.',
        code: 'META_WHATSAPP_WORKSPACE_INTEGRATION_MISSING',
        retryable: false,
        details: {
          workspaceId: input.workspaceId
        }
      });
    }
    const payload = buildTemplatePayload(input, to) ?? buildTextPayload(input, to);
    const graphApiVersion = normalizeGraphApiVersion(credentials.graphApiVersion ?? this.graphApiVersion);
    const response = await this.fetchImpl(
      `https://graph.facebook.com/${graphApiVersion}/${credentials.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }
    );
    const responsePayload = await response.json();

    if (!response.ok) {
      const metaError = readMetaError(responsePayload);
      throw new CommunicationProviderError({
        message: metaError.message,
        code: metaError.code ? `META_WHATSAPP_${metaError.code}` : 'META_WHATSAPP_SEND_FAILED',
        retryable: retryableStatusCodes.has(response.status) || response.status >= 500,
        details: {
          statusCode: response.status,
          type: metaError.type,
          fbtraceId: metaError.fbtraceId
        }
      });
    }

    const providerMessageId = extractProviderMessageId(responsePayload);
    if (!providerMessageId) {
      throw new CommunicationProviderError({
        message: 'Meta WhatsApp did not return a message id.',
        code: 'META_WHATSAPP_MESSAGE_ID_MISSING',
        retryable: true,
        details: {
          statusCode: response.status
        }
      });
    }

    return {
      provider: this.provider,
      providerMessageId,
      status: 'sent',
      sentAt: new Date().toISOString(),
      raw: {
        provider: this.provider,
        providerMessageId
      }
    };
  }
}

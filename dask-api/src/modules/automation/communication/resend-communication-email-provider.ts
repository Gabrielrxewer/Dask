import { Resend } from 'resend';
import {
  CommunicationProviderError,
  type CommunicationProvider,
  type CommunicationSendInput,
  type CommunicationSendResult
} from '@/modules/automation/communication/communication-provider';

type ResendEmailClient = {
  emails: {
    send(input: {
      from: string;
      to: string;
      subject: string;
      html?: string;
      text?: string;
      replyTo?: string;
      headers?: Record<string, string>;
    }): Promise<{
      data?: { id?: string } | null;
      error?: unknown;
    }>;
  };
};

const basicEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const retryableStatusCodes = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readStatusCode(error: unknown): number | null {
  if (!isRecord(error)) {
    return null;
  }

  const statusCode = error.statusCode ?? error.status ?? error.code;
  if (typeof statusCode === 'number') {
    return statusCode;
  }
  if (typeof statusCode === 'string' && /^\d+$/.test(statusCode)) {
    return Number(statusCode);
  }

  return null;
}

function providerErrorFromResend(error: unknown): CommunicationProviderError {
  const statusCode = readStatusCode(error);
  const message = isRecord(error) && typeof error.message === 'string'
    ? error.message
    : 'Resend email send failed.';
  const code = isRecord(error) && typeof error.name === 'string'
    ? `RESEND_${error.name.toUpperCase()}`
    : 'RESEND_SEND_FAILED';
  const retryable = statusCode
    ? retryableStatusCodes.has(statusCode) || statusCode >= 500
    : /timeout|timed out|network|econnreset|rate limit|too many requests/i.test(message);

  return new CommunicationProviderError({
    message,
    code,
    retryable,
    details: {
      statusCode
    }
  });
}

function validateEmailPayload(input: CommunicationSendInput, from: string): {
  from: string;
  replyTo?: string;
  subject: string;
  html?: string;
  text?: string;
} {
  if (!basicEmailPattern.test(input.to)) {
    throw new CommunicationProviderError({
      message: 'Invalid email recipient.',
      code: 'INVALID_EMAIL_RECIPIENT',
      retryable: false,
      details: {
        to: input.to
      }
    });
  }

  if (!basicEmailPattern.test(from.replace(/^.*<([^>]+)>.*$/, '$1'))) {
    throw new CommunicationProviderError({
      message: 'Invalid email sender.',
      code: 'INVALID_EMAIL_FROM',
      retryable: false
    });
  }

  const subject = readString(input.subject);
  if (!subject) {
    throw new CommunicationProviderError({
      message: 'Email subject is required.',
      code: 'EMAIL_SUBJECT_REQUIRED',
      retryable: false
    });
  }

  const html = readString(input.html);
  const text = readString(input.text) ?? readString(input.body);
  if (!html && !text) {
    throw new CommunicationProviderError({
      message: 'Email text or html body is required.',
      code: 'EMAIL_BODY_REQUIRED',
      retryable: false
    });
  }

  return {
    from,
    replyTo: readString(input.replyTo) ?? undefined,
    subject,
    html: html ?? undefined,
    text: text ?? undefined
  };
}

export class ResendCommunicationEmailProvider implements CommunicationProvider {
  public readonly channel = 'email' as const;
  public readonly provider = 'resend';
  private readonly client: ResendEmailClient;

  public constructor(private readonly input: {
    apiKey?: string;
    defaultFrom: string;
    defaultReplyTo?: string;
    client?: ResendEmailClient;
  }) {
    if (!input.apiKey && !input.client) {
      throw new CommunicationProviderError({
        message: 'RESEND_API_KEY is required for automation email send mode "real".',
        code: 'RESEND_API_KEY_MISSING',
        retryable: false
      });
    }

    this.client = input.client ?? (new Resend(input.apiKey) as ResendEmailClient);
  }

  public async send(input: CommunicationSendInput): Promise<CommunicationSendResult> {
    if (input.channel !== 'email') {
      throw new CommunicationProviderError({
        message: 'Resend provider only supports email channel.',
        code: 'RESEND_UNSUPPORTED_CHANNEL',
        retryable: false
      });
    }

    const email = validateEmailPayload(input, input.from ?? this.input.defaultFrom);
    const replyTo = email.replyTo ?? this.input.defaultReplyTo;

    const { data, error } = await this.client.emails.send({
      from: email.from,
      to: input.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
      replyTo,
      headers: input.metadata
        ? {
            'X-Dask-Automation-Run-Id': input.runId,
            'X-Dask-Automation-Step-Run-Id': input.stepRunId
          }
        : undefined
    });

    if (error) {
      throw providerErrorFromResend(error);
    }

    const providerMessageId = data?.id;
    if (!providerMessageId) {
      throw new CommunicationProviderError({
        message: 'Resend did not return a message id.',
        code: 'RESEND_MESSAGE_ID_MISSING',
        retryable: true
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

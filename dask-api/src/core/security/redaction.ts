export const REDACTED = '[REDACTED]';

const DEFAULT_MAX_STRING_LENGTH = 2000;
const DEFAULT_MAX_ARRAY_LENGTH = 50;
const DEFAULT_MAX_OBJECT_KEYS = 50;
const DEFAULT_MAX_DEPTH = 8;
const MAX_DEPTH_PLACEHOLDER = '[MaxDepth]';

export const sensitiveRedactionKeyPattern =
  /(authorization|cookie|credential|password|passwd|secret|token|api[-_]?key|access[-_]?key|refresh[-_]?token|session|signature|webhook[-_]?secret|stripe[-_]?(?:secret|key)|focus[-_]?token|client[-_]?secret|private[-_]?key|prompt|system[-_]?prompt|user[-_]?prompt)/i;

const sensitiveTextRedactors: Array<(value: string) => string> = [
  (value) => value.replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, `Bearer ${REDACTED}`),
  (value) => value.replace(/\bBasic\s+[A-Za-z0-9+/=:_-]{8,}/gi, `Basic ${REDACTED}`),
  (value) => value.replace(/\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9_]{8,}\b/g, REDACTED),
  (value) => value.replace(/\bwhsec_[A-Za-z0-9_]{8,}\b/g, REDACTED),
  (value) => value.replace(/\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g, REDACTED),
  (value) => value.replace(/\bsk-[A-Za-z0-9_-]*\*{4,}[A-Za-z0-9_*.-]*\b/g, REDACTED),
  (value) => value.replace(/\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g, REDACTED),
  (value) => value.replace(/\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, REDACTED),
  (value) => value.replace(/\bAIza[A-Za-z0-9_-]{10,}\b/g, REDACTED),
  (value) => value.replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, REDACTED),
  (value) =>
    value.replace(
      /([?&](?:token|access_token|refresh_token|api_key|apikey|client_secret|secret|signature|webhook_secret|focus_token|billingToken|clientAccessToken|portalToken)=)[^&\s]+/gi,
      `$1${REDACTED}`
    ),
  (value) =>
    value.replace(
      /\b((?:authorization|password|passwd|secret|token|api[-_]?key|apiKey|access[-_]?token|accessToken|refresh[-_]?token|refreshToken|focus[-_]?token|focusToken|webhook[-_]?secret|webhookSecret|client[-_]?secret|clientSecret|prompt|system[-_]?prompt|systemPrompt|user[-_]?prompt|userPrompt)\s*[:=]\s*)(["']?)[^\s'",}]+/gi,
      `$1$2${REDACTED}`
    )
];

const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const phonePattern = /(?<![\w])\+?(?:\d[\s().-]?){9,15}\d(?![\w])/g;
const cardLikePattern = /\b(?:\d[ -]*?){13,19}\b/g;
const brazilianDocumentKeyPattern =
  /(cnpj|cpf|cnpjcpf|tax[-_]?id|documento|document|inscricao|inscri[cç][aã]o)/i;

export type RedactionOptions = {
  maskPersonalData?: boolean;
  maskBrazilianDocuments?: boolean;
  maxStringLength?: number;
  maxArrayLength?: number;
  maxObjectKeys?: number;
  maxDepth?: number;
  omitKeys?: readonly string[];
  additionalSensitiveKeyPattern?: RegExp;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

export function maskEmail(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  const at = normalized.indexOf('@');
  if (at <= 0) {
    return normalized ? REDACTED : null;
  }

  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  const visible = local.slice(0, 1);
  return `${visible}***@${domain}`;
}

export function maskPhone(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  const digits = normalized.replace(/\D/g, '');
  if (digits.length < 8) {
    return normalized || null;
  }

  const prefix = normalized.startsWith('+') && digits.length > 10 ? `+${digits.slice(0, 2)}` : '';
  return `${prefix}******${digits.slice(-4)}`;
}

function maskBrazilianDocument(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const digits = value.replace(/\D/g, '');
  if (digits.length === 11) {
    return `***.***.***-${digits.slice(-2)}`;
  }
  if (digits.length === 14) {
    return `**.***.***/****-${digits.slice(-2)}`;
  }
  if (digits.length > 4) {
    return `***${digits.slice(-2)}`;
  }
  return value;
}

function maskPersonalDataInText(value: string): string {
  return value
    .replace(emailPattern, (match) => maskEmail(match) ?? REDACTED)
    .replace(phonePattern, (match) => maskPhone(match) ?? REDACTED);
}

function redactPersonalDataInText(value: string): string {
  return value
    .replace(emailPattern, REDACTED)
    .replace(phonePattern, REDACTED);
}

export function redactSensitiveText(value: string, options: Pick<RedactionOptions, 'maskPersonalData'> = {}): string {
  const withoutSecrets = sensitiveTextRedactors.reduce((text, redactor) => redactor(text), value);
  const withoutPersonalData = options.maskPersonalData
    ? maskPersonalDataInText(withoutSecrets)
    : redactPersonalDataInText(withoutSecrets);
  return withoutPersonalData.replace(cardLikePattern, REDACTED);
}

export function isSensitiveRedactionKey(
  key: string,
  additionalSensitiveKeyPattern?: RegExp
): boolean {
  return sensitiveRedactionKeyPattern.test(key) || Boolean(additionalSensitiveKeyPattern?.test(key));
}

function redactValue(value: unknown, options: Required<Omit<RedactionOptions, 'additionalSensitiveKeyPattern'>> & {
  additionalSensitiveKeyPattern?: RegExp;
}, depth: number, key?: string): unknown {
  if (depth > options.maxDepth) {
    return MAX_DEPTH_PLACEHOLDER;
  }

  if (key && isSensitiveRedactionKey(key, options.additionalSensitiveKeyPattern)) {
    return REDACTED;
  }

  if (options.maskBrazilianDocuments && key && brazilianDocumentKeyPattern.test(key)) {
    return maskBrazilianDocument(value);
  }

  if (value === null || value === undefined) {
    return value;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (value instanceof Error) {
    return redactError(value, options);
  }

  if (typeof value === 'string') {
    return truncate(redactSensitiveText(value, { maskPersonalData: options.maskPersonalData }), options.maxStringLength);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, options.maxArrayLength)
      .map((entry) => redactValue(entry, options, depth + 1));
  }

  if (!isRecord(value)) {
    return truncate(redactSensitiveText(String(value), { maskPersonalData: options.maskPersonalData }), options.maxStringLength);
  }

  const omitKeys = new Set(options.omitKeys.map((entry) => entry.toLowerCase()));
  const output: Record<string, unknown> = {};
  for (const [entryKey, entryValue] of Object.entries(value).slice(0, options.maxObjectKeys)) {
    if (omitKeys.has(entryKey.toLowerCase())) {
      continue;
    }
    output[entryKey] = redactValue(entryValue, options, depth + 1, entryKey);
  }
  return output;
}

function normalizeOptions(options: RedactionOptions): Required<Omit<RedactionOptions, 'additionalSensitiveKeyPattern'>> & {
  additionalSensitiveKeyPattern?: RegExp;
} {
  return {
    maskPersonalData: options.maskPersonalData ?? false,
    maskBrazilianDocuments: options.maskBrazilianDocuments ?? false,
    maxStringLength: options.maxStringLength ?? DEFAULT_MAX_STRING_LENGTH,
    maxArrayLength: options.maxArrayLength ?? DEFAULT_MAX_ARRAY_LENGTH,
    maxObjectKeys: options.maxObjectKeys ?? DEFAULT_MAX_OBJECT_KEYS,
    maxDepth: options.maxDepth ?? DEFAULT_MAX_DEPTH,
    omitKeys: options.omitKeys ?? ['stack'],
    additionalSensitiveKeyPattern: options.additionalSensitiveKeyPattern
  };
}

export function redactSensitiveValue<T>(value: T, options: RedactionOptions = {}): T {
  return redactValue(value, normalizeOptions(options), 0) as T;
}

export function redactLogData<T>(value: T): T {
  return redactSensitiveValue(value, {
    maskPersonalData: true,
    maskBrazilianDocuments: false,
    maxStringLength: 2000,
    maxArrayLength: 50,
    maxObjectKeys: 80,
    maxDepth: 8
  });
}

export function redactMetadata<T>(value: T): T {
  return redactSensitiveValue(value, {
    maskPersonalData: true,
    maskBrazilianDocuments: true,
    maxStringLength: 4000,
    maxArrayLength: 100,
    maxObjectKeys: 100,
    maxDepth: 8
  });
}

export function redactErrorMessage(error: unknown, maxLength = DEFAULT_MAX_STRING_LENGTH): string {
  const raw = error instanceof Error ? error.message : String(error);
  return truncate(redactSensitiveText(raw, { maskPersonalData: true }), maxLength);
}

export function redactError(
  error: unknown,
  options: RedactionOptions = {}
): Record<string, unknown> {
  const normalizedOptions = normalizeOptions({ maskPersonalData: true, ...options });

  if (error instanceof Error) {
    const candidate = error as Error & {
      code?: unknown;
      statusCode?: unknown;
      details?: unknown;
    };
    return {
      name: candidate.name,
      message: redactErrorMessage(candidate),
      ...(typeof candidate.code === 'string' ? { code: candidate.code } : {}),
      ...(typeof candidate.statusCode === 'number' ? { statusCode: candidate.statusCode } : {}),
      ...(candidate.details !== undefined
        ? { details: redactValue(candidate.details, normalizedOptions, 0) }
        : {})
    };
  }

  if (isRecord(error)) {
    return redactValue(error, normalizedOptions, 0) as Record<string, unknown>;
  }

  return {
    message: redactErrorMessage(error)
  };
}

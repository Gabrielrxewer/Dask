import crypto from 'crypto';

export type BillingPortalTokenScope =
  | 'view'
  | 'pay'
  | 'download_receipt'
  | 'download_fiscal_document';

export const DEFAULT_BILLING_PORTAL_SCOPES: BillingPortalTokenScope[] = [
  'view',
  'pay',
  'download_receipt',
  'download_fiscal_document'
];

export interface BillingPortalTokenClaims {
  version: 1;
  workspaceId: string;
  orderId: string;
  customerEmail?: string | null;
  scopes: BillingPortalTokenScope[];
  jti: string;
  iat: number;
  exp: number;
}

export interface CreateBillingPortalTokenInput {
  workspaceId: string;
  orderId: string;
  customerEmail?: string | null;
  scopes?: BillingPortalTokenScope[];
  expiresInSeconds?: number;
  secret: string;
}

export interface CreatedBillingPortalToken {
  token: string;
  tokenId: string;
  tokenHash: string;
  expiresAt: Date;
  scopes: BillingPortalTokenScope[];
}

const DEFAULT_EXPIRES_IN_SECONDS = 7 * 24 * 60 * 60;

function encodePart(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decodePart(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signPayload(encodedPayload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('base64url');
}

function assertSecret(secret: string): void {
  if (!secret || secret.trim().length < 16) {
    throw new Error('Billing portal token secret must have at least 16 characters.');
  }
}

function constantTimeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function parseClaims(raw: unknown): BillingPortalTokenClaims {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Invalid billing portal token payload.');
  }

  const claims = raw as Partial<BillingPortalTokenClaims>;
  if (
    claims.version !== 1 ||
    typeof claims.workspaceId !== 'string' ||
    typeof claims.orderId !== 'string' ||
    typeof claims.jti !== 'string' ||
    typeof claims.iat !== 'number' ||
    typeof claims.exp !== 'number' ||
    !Array.isArray(claims.scopes)
  ) {
    throw new Error('Invalid billing portal token claims.');
  }

  return {
    version: 1,
    workspaceId: claims.workspaceId,
    orderId: claims.orderId,
    customerEmail: typeof claims.customerEmail === 'string' ? claims.customerEmail : null,
    scopes: claims.scopes.filter((scope): scope is BillingPortalTokenScope =>
      DEFAULT_BILLING_PORTAL_SCOPES.includes(scope as BillingPortalTokenScope)
    ),
    jti: claims.jti,
    iat: claims.iat,
    exp: claims.exp
  };
}

export function hashBillingPortalToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createBillingPortalToken(input: CreateBillingPortalTokenInput): CreatedBillingPortalToken {
  assertSecret(input.secret);

  const nowInSeconds = Math.floor(Date.now() / 1000);
  const expiresInSeconds = input.expiresInSeconds ?? DEFAULT_EXPIRES_IN_SECONDS;
  const tokenId = crypto.randomUUID();
  const scopes = input.scopes && input.scopes.length > 0
    ? Array.from(new Set(input.scopes))
    : DEFAULT_BILLING_PORTAL_SCOPES;
  const claims: BillingPortalTokenClaims = {
    version: 1,
    workspaceId: input.workspaceId,
    orderId: input.orderId,
    customerEmail: input.customerEmail ?? null,
    scopes,
    jti: tokenId,
    iat: nowInSeconds,
    exp: nowInSeconds + expiresInSeconds
  };
  const encodedPayload = encodePart(JSON.stringify(claims));
  const signature = signPayload(encodedPayload, input.secret);
  const token = `${encodedPayload}.${signature}`;

  return {
    token,
    tokenId,
    tokenHash: hashBillingPortalToken(token),
    expiresAt: new Date(claims.exp * 1000),
    scopes
  };
}

export function verifyBillingPortalToken(token: string, secret: string): BillingPortalTokenClaims {
  assertSecret(secret);

  const [encodedPayload, signature, ...rest] = token.split('.');
  if (!encodedPayload || !signature || rest.length > 0) {
    throw new Error('Invalid billing portal token format.');
  }

  const expectedSignature = signPayload(encodedPayload, secret);
  if (!constantTimeEquals(signature, expectedSignature)) {
    throw new Error('Invalid billing portal token signature.');
  }

  const claims = parseClaims(JSON.parse(decodePart(encodedPayload)));
  if (claims.exp <= Math.floor(Date.now() / 1000)) {
    throw new Error('Billing portal token expired.');
  }

  return claims;
}

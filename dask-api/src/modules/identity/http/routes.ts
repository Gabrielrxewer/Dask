import crypto from 'crypto';
import type { CookieOptions } from 'express';
import type { Response } from 'express';
import { Router } from 'express';
import jwt, { type JwtHeader } from 'jsonwebtoken';
import { AppError } from '@/core/errors/app-error';
import { asyncHandler } from '@/core/http/async-handler';
import { authMiddleware } from '@/core/http/auth-middleware';
import {
  CSRF_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  getClearCsrfCookieOptions,
  getClearSessionCookieOptions,
  getCsrfCookieOptions,
  getSessionCookieOptions
} from '@/core/http/cookie-config';
import { createCsrfMiddleware, generateCsrfToken } from '@/core/http/csrf-middleware';
import { createRateLimiter } from '@/core/http/rate-limit-middleware';
import { env } from '@/core/config/env';
import type { AuthService, RequestContext } from '@/modules/identity/application/auth-service';
import type { OrganizationService } from '@/modules/identity/application/organization-service';
import type { WorkspaceInvitesService } from '@/modules/workspace-platform/application/workspace-invites-service';
import {
  confirmPasswordResetDto,
  createOrganizationDto,
  loginDto,
  registerDto,
  requestPasswordResetDto,
  updateUserProfileDto,
  updateUserAvatarDto
} from '@/modules/identity/http/dto';

const registerLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 10 });
const loginLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 20 });
const refreshLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 15 });
const resetLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 5 });
const verifyResendLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 3 });

function extractContext(req: { ip?: string; headers: Record<string, string | string[] | undefined> }): RequestContext {
  return {
    ip: req.ip,
    userAgent: req.headers['user-agent'] as string | undefined
  };
}

function setNoStore(res: Response): void {
  res.set('Cache-Control', 'no-store');
  res.set('Pragma', 'no-cache');
}

function setSessionCookies(res: Response, rawRefreshToken: string): void {
  res.cookie(SESSION_COOKIE_NAME, rawRefreshToken, getSessionCookieOptions());
  res.cookie(CSRF_COOKIE_NAME, generateCsrfToken(rawRefreshToken, env.CSRF_SECRET), getCsrfCookieOptions());
}

function clearSessionCookies(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, getClearSessionCookieOptions());
  res.clearCookie(CSRF_COOKIE_NAME, getClearCsrfCookieOptions());
}

function buildGoogleAuthorizeUrl(input: { state: string; nonce: string; codeChallenge: string }): string {
  if (!env.GOOGLE_OAUTH_CLIENT_ID) {
    throw new AppError('Google OAuth is not configured.', 503);
  }
  const redirectUri = assertRedirectUriPathMatchesExpected(
    env.GOOGLE_OAUTH_REDIRECT_URI,
    `${env.API_PREFIX}/auth/google/callback`,
    'Google'
  );

  const params = new URLSearchParams({
    client_id: env.GOOGLE_OAUTH_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
    state: input.state,
    nonce: input.nonce,
    code_challenge: input.codeChallenge,
    code_challenge_method: 'S256'
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

function buildMicrosoftAuthorizeUrl(input: { state: string; nonce: string; codeChallenge: string }): string {
  if (!env.MICROSOFT_OAUTH_CLIENT_ID) {
    throw new AppError('Microsoft OAuth is not configured.', 503);
  }
  const redirectUri = assertRedirectUriPathMatchesExpected(
    env.MICROSOFT_OAUTH_REDIRECT_URI,
    `${env.API_PREFIX}/auth/microsoft/callback`,
    'Microsoft'
  );

  const tenantId = env.MICROSOFT_OAUTH_TENANT_ID || 'common';
  const params = new URLSearchParams({
    client_id: env.MICROSOFT_OAUTH_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    response_mode: 'query',
    scope: 'openid profile email offline_access',
    state: input.state,
    nonce: input.nonce,
    code_challenge: input.codeChallenge,
    code_challenge_method: 'S256'
  });

  return `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/authorize?${params.toString()}`;
}

function resolvePostAuthRedirectUrl(allowedOrigins: string[], preferredOrigin?: string): string {
  const baseUrl = resolveAuthRedirectBaseUrl(allowedOrigins, preferredOrigin);
  return `${baseUrl}/w`;
}

function resolveLinkRequiredRedirectUrl(
  allowedOrigins: string[],
  provider: 'google' | 'microsoft',
  preferredOrigin?: string
): string {
  const baseUrl = resolveAuthRedirectBaseUrl(allowedOrigins, preferredOrigin);
  return `${baseUrl}/login?oauth=link_required&provider=${provider}`;
}

type OAuthRedirectErrorCode =
  | 'cancelled'
  | 'session_expired'
  | 'invalid_request'
  | 'provider_auth_failed'
  | 'provider_unavailable'
  | 'provider_rejected'
  | 'unexpected';

function resolveOAuthErrorRedirectUrl(
  allowedOrigins: string[],
  provider: 'google' | 'microsoft',
  errorCode: OAuthRedirectErrorCode,
  preferredOrigin?: string
): string {
  const baseUrl = resolveAuthRedirectBaseUrl(allowedOrigins, preferredOrigin);
  const params = new URLSearchParams({
    oauth: 'error',
    provider,
    error: errorCode
  });
  return `${baseUrl}/login?${params.toString()}`;
}

function resolveAuthRedirectBaseUrl(allowedOrigins: string[], preferredOrigin?: string): string {
  const candidates = [preferredOrigin, env.APP_URL, ...allowedOrigins, 'http://localhost:5173'];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'string') {
      continue;
    }

    const trimmed = candidate.trim();
    if (!trimmed) {
      continue;
    }

    try {
      const parsed = new URL(trimmed);
      return parsed.toString().replace(/\/+$/, '');
    } catch {
      continue;
    }
  }

  return 'http://localhost:5173';
}

function normalizeOrigin(origin: string): string | null {
  try {
    return new URL(origin).origin;
  } catch {
    return null;
  }
}

function resolveAllowedOrigin(candidate: string | null | undefined, allowedOrigins: string[]): string | undefined {
  if (!candidate) {
    return undefined;
  }
  const normalized = normalizeOrigin(candidate);
  if (!normalized) {
    return undefined;
  }
  return allowedOrigins.includes(normalized) ? normalized : undefined;
}

function resolveOAuthProviderErrorCode(providerError: string): OAuthRedirectErrorCode {
  if (providerError === 'access_denied') {
    return 'cancelled';
  }
  if (providerError === 'temporarily_unavailable' || providerError === 'server_error') {
    return 'provider_unavailable';
  }
  return 'provider_rejected';
}

function resolveOAuthCallbackErrorCode(error: unknown): OAuthRedirectErrorCode {
  if (!(error instanceof AppError)) {
    return 'unexpected';
  }

  if (error.statusCode === 503) {
    return 'provider_unavailable';
  }

  if (error.statusCode === 401) {
    return 'provider_auth_failed';
  }

  if (error.statusCode === 400) {
    const message = error.message.toLowerCase();
    if (
      message.includes('state') ||
      message.includes('nonce') ||
      message.includes('pkce') ||
      message.includes('missing code')
    ) {
      return 'session_expired';
    }

    return 'invalid_request';
  }

  return 'unexpected';
}

async function readJsonResponse(response: globalThis.Response): Promise<Record<string, unknown>> {
  const raw = (await response.json()) as unknown;
  return typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
}

type OAuthProvider = 'google' | 'microsoft';
type JwkKey = {
  kid?: string;
  kty?: string;
  n?: string;
  e?: string;
  [key: string]: unknown;
};

type OidcIdTokenClaims = {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nonce?: string;
  tid?: string;
};

const OAUTH_MAX_AGE_MS = 10 * 60 * 1000;
const JWKS_CACHE_TTL_MS = 60 * 60 * 1000;

type JsonWebKeySet = {
  keys?: JwkKey[];
};

type CachedJwks = {
  expiresAt: number;
  keys: JwkKey[];
};

const jwksCache = new Map<OAuthProvider, CachedJwks>();

function base64UrlEncode(input: Buffer): string {
  return input
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function sha256Base64Url(input: string): string {
  return base64UrlEncode(crypto.createHash('sha256').update(input, 'utf8').digest());
}

function randomBase64Url(bytes = 32): string {
  return base64UrlEncode(crypto.randomBytes(bytes));
}

function timingSafeEqualString(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function getOauthCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: OAUTH_MAX_AGE_MS
  };
}

function getClearOauthCookieOptions(): CookieOptions {
  return {
    ...getOauthCookieOptions(),
    maxAge: 0,
    expires: new Date(0)
  };
}

function oauthCookieName(provider: OAuthProvider, key: 'state' | 'nonce' | 'pkce' | 'return' | 'invite'): string {
  return `dask-oauth-${provider}-${key}`;
}

function setOauthFlowCookies(
  res: Response,
  provider: OAuthProvider,
  values: { state: string; nonce: string; pkceVerifier: string; returnOrigin?: string; inviteToken?: string }
): void {
  const options = getOauthCookieOptions();
  res.cookie(oauthCookieName(provider, 'state'), values.state, options);
  res.cookie(oauthCookieName(provider, 'nonce'), values.nonce, options);
  res.cookie(oauthCookieName(provider, 'pkce'), values.pkceVerifier, options);
  if (values.returnOrigin) {
    res.cookie(oauthCookieName(provider, 'return'), values.returnOrigin, options);
  }
  if (values.inviteToken) {
    res.cookie(oauthCookieName(provider, 'invite'), values.inviteToken, options);
  }
}

function clearOauthFlowCookies(res: Response, provider: OAuthProvider): void {
  const clearOptions = getClearOauthCookieOptions();
  res.clearCookie(oauthCookieName(provider, 'state'), clearOptions);
  res.clearCookie(oauthCookieName(provider, 'nonce'), clearOptions);
  res.clearCookie(oauthCookieName(provider, 'pkce'), clearOptions);
  res.clearCookie(oauthCookieName(provider, 'return'), clearOptions);
  res.clearCookie(oauthCookieName(provider, 'invite'), clearOptions);
}

function assertRedirectUriPathMatchesExpected(value: string | undefined, expectedPath: string, providerLabel: string): string {
  if (!value) {
    throw new AppError(`${providerLabel} OAuth redirect URI is not configured.`, 503);
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AppError(`${providerLabel} OAuth redirect URI is invalid.`, 503);
  }

  if (url.pathname !== expectedPath) {
    throw new AppError(`${providerLabel} OAuth redirect URI path mismatch.`, 503);
  }

  return value;
}

function parseIdTokenClaims(idToken: string): OidcIdTokenClaims {
  const segments = idToken.split('.');
  if (segments.length !== 3) {
    throw new AppError('Invalid id_token format.', 401);
  }

  const payloadSegment = segments[1];
  const normalizedPayload = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
  const paddedPayload = normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, '=');

  let decoded: string;
  try {
    decoded = Buffer.from(paddedPayload, 'base64').toString('utf8');
  } catch {
    throw new AppError('Invalid id_token payload.', 401);
  }

  let claims: unknown;
  try {
    claims = JSON.parse(decoded);
  } catch {
    throw new AppError('Invalid id_token claims.', 401);
  }

  if (typeof claims !== 'object' || claims === null) {
    throw new AppError('Invalid id_token claims.', 401);
  }

  return claims as OidcIdTokenClaims;
}

function decodeJwtHeader(idToken: string): JwtHeader & { kid?: string; alg?: string } {
  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded || typeof decoded !== 'object' || !('header' in decoded) || typeof decoded.header !== 'object') {
    throw new AppError('Invalid id_token header.', 401);
  }
  return decoded.header as JwtHeader & { kid?: string; alg?: string };
}

function resolveJwksUrl(provider: OAuthProvider): string {
  if (provider === 'google') {
    return 'https://www.googleapis.com/oauth2/v3/certs';
  }
  return 'https://login.microsoftonline.com/common/discovery/v2.0/keys';
}

async function fetchJwks(provider: OAuthProvider): Promise<JwkKey[]> {
  const cached = jwksCache.get(provider);
  const now = Date.now();
  if (cached && cached.expiresAt > now && cached.keys.length > 0) {
    return cached.keys;
  }

  const response = await fetch(resolveJwksUrl(provider));
  if (!response.ok) {
    throw new AppError('Failed to fetch JWKS.', 503);
  }

  const payload = (await response.json()) as JsonWebKeySet;
  const keys = Array.isArray(payload.keys) ? payload.keys : [];
  if (keys.length === 0) {
    throw new AppError('JWKS payload is invalid.', 503);
  }

  jwksCache.set(provider, {
    keys,
    expiresAt: now + JWKS_CACHE_TTL_MS
  });

  return keys;
}

async function verifyIdTokenSignature(idToken: string, provider: OAuthProvider): Promise<void> {
  const header = decodeJwtHeader(idToken);
  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || header.kid.length === 0) {
    throw new AppError('Unsupported id_token signature header.', 401);
  }

  const keys = await fetchJwks(provider);
  const jwk = keys.find((item) => item.kid === header.kid && item.kty === 'RSA');
  if (!jwk) {
    throw new AppError('id_token signing key not found.', 401);
  }

  let publicKey: string;
  try {
    publicKey = crypto
      .createPublicKey({
        key: jwk as Record<string, unknown>,
        format: 'jwk'
      })
      .export({ format: 'pem', type: 'spki' })
      .toString();
  } catch {
    throw new AppError('Invalid id_token signing key.', 401);
  }

  try {
    jwt.verify(idToken, publicKey, { algorithms: ['RS256'] });
  } catch {
    throw new AppError('Invalid id_token signature.', 401);
  }
}

function validateAudienceClaim(aud: string | string[] | undefined, expectedClientId: string): boolean {
  if (typeof aud === 'string') {
    return aud === expectedClientId;
  }
  if (Array.isArray(aud)) {
    return aud.includes(expectedClientId);
  }
  return false;
}

async function validateGoogleIdTokenClaims(idToken: string, expectedNonce: string): Promise<void> {
  if (!env.GOOGLE_OAUTH_CLIENT_ID) {
    throw new AppError('Google OAuth is not configured.', 503);
  }

  await verifyIdTokenSignature(idToken, 'google');
  const claims = parseIdTokenClaims(idToken);
  const validIss = claims.iss === 'https://accounts.google.com' || claims.iss === 'accounts.google.com';
  if (!validIss) {
    throw new AppError('Google id_token issuer mismatch.', 401);
  }

  if (!validateAudienceClaim(claims.aud, env.GOOGLE_OAUTH_CLIENT_ID)) {
    throw new AppError('Google id_token audience mismatch.', 401);
  }

  const nowInSeconds = Math.floor(Date.now() / 1000);
  if (typeof claims.exp !== 'number' || claims.exp <= nowInSeconds) {
    throw new AppError('Google id_token expired.', 401);
  }

  if (typeof claims.nonce !== 'string' || !timingSafeEqualString(claims.nonce, expectedNonce)) {
    throw new AppError('Google id_token nonce mismatch.', 401);
  }
}

async function validateMicrosoftIdTokenClaims(idToken: string, expectedNonce: string): Promise<void> {
  if (!env.MICROSOFT_OAUTH_CLIENT_ID) {
    throw new AppError('Microsoft OAuth is not configured.', 503);
  }

  await verifyIdTokenSignature(idToken, 'microsoft');
  const claims = parseIdTokenClaims(idToken);
  if (typeof claims.iss !== 'string' || !claims.iss.startsWith('https://login.microsoftonline.com/')) {
    throw new AppError('Microsoft id_token issuer mismatch.', 401);
  }

  if (!validateAudienceClaim(claims.aud, env.MICROSOFT_OAUTH_CLIENT_ID)) {
    throw new AppError('Microsoft id_token audience mismatch.', 401);
  }

  const nowInSeconds = Math.floor(Date.now() / 1000);
  if (typeof claims.exp !== 'number' || claims.exp <= nowInSeconds) {
    throw new AppError('Microsoft id_token expired.', 401);
  }

  if (typeof claims.nonce !== 'string' || !timingSafeEqualString(claims.nonce, expectedNonce)) {
    throw new AppError('Microsoft id_token nonce mismatch.', 401);
  }
}

async function exchangeGoogleCodeForAccessToken(
  code: string,
  codeVerifier: string
): Promise<{ accessToken: string; idToken: string }> {
  if (!env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET) {
    throw new AppError('Google OAuth is not configured.', 503);
  }
  const redirectUri = assertRedirectUriPathMatchesExpected(
    env.GOOGLE_OAUTH_REDIRECT_URI,
    `${env.API_PREFIX}/auth/google/callback`,
    'Google'
  );

  const body = new URLSearchParams({
    code,
    client_id: env.GOOGLE_OAUTH_CLIENT_ID,
    client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    code_verifier: codeVerifier
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  if (!response.ok) {
    throw new AppError('Failed to exchange Google OAuth code.', 401);
  }

  const payload = await readJsonResponse(response);
  const accessToken = payload.access_token;
  const idToken = payload.id_token;

  if (
    typeof accessToken !== 'string' ||
    accessToken.length === 0 ||
    typeof idToken !== 'string' ||
    idToken.length === 0
  ) {
    throw new AppError('Invalid Google token response.', 401);
  }

  return { accessToken, idToken };
}

async function fetchGoogleUserProfile(accessToken: string): Promise<{
  subject: string;
  email: string;
  name: string;
  emailVerified: boolean | null;
  pictureUrl: string | null;
}> {
  const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    throw new AppError('Failed to fetch Google profile.', 401);
  }

  const payload = await readJsonResponse(response);
  const subject = payload.sub;
  const email = payload.email;
  const name = payload.name;
  const emailVerified = payload.email_verified;
  const picture = payload.picture;

  if (typeof subject !== 'string' || typeof email !== 'string' || subject.length === 0 || email.length === 0) {
    throw new AppError('Google profile is missing required fields.', 400);
  }

  return {
    subject,
    email,
    name: typeof name === 'string' && name.length > 0 ? name : email,
    emailVerified: typeof emailVerified === 'boolean' ? emailVerified : null,
    pictureUrl: typeof picture === 'string' && picture.length > 0 ? picture : null
  };
}

async function exchangeMicrosoftCodeForAccessToken(
  code: string,
  codeVerifier: string
): Promise<{ accessToken: string; idToken: string }> {
  if (!env.MICROSOFT_OAUTH_CLIENT_ID || !env.MICROSOFT_OAUTH_CLIENT_SECRET) {
    throw new AppError('Microsoft OAuth is not configured.', 503);
  }
  const redirectUri = assertRedirectUriPathMatchesExpected(
    env.MICROSOFT_OAUTH_REDIRECT_URI,
    `${env.API_PREFIX}/auth/microsoft/callback`,
    'Microsoft'
  );

  const tenantId = env.MICROSOFT_OAUTH_TENANT_ID || 'common';
  const body = new URLSearchParams({
    code,
    client_id: env.MICROSOFT_OAUTH_CLIENT_ID,
    client_secret: env.MICROSOFT_OAUTH_CLIENT_SECRET,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    code_verifier: codeVerifier
  });

  const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  if (!response.ok) {
    throw new AppError('Failed to exchange Microsoft OAuth code.', 401);
  }

  const payload = await readJsonResponse(response);
  const accessToken = payload.access_token;
  const idToken = payload.id_token;

  if (
    typeof accessToken !== 'string' ||
    accessToken.length === 0 ||
    typeof idToken !== 'string' ||
    idToken.length === 0
  ) {
    throw new AppError('Invalid Microsoft token response.', 401);
  }

  return { accessToken, idToken };
}

async function fetchMicrosoftUserProfile(accessToken: string): Promise<{
  subject: string;
  email: string;
  name: string;
  tenantId: string | null;
  pictureUrl: string | null;
}> {
  const response = await fetch('https://graph.microsoft.com/oidc/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    throw new AppError('Failed to fetch Microsoft profile.', 401);
  }

  const payload = await readJsonResponse(response);
  const subject = payload.sub;
  const email = payload.email ?? payload.preferred_username;
  const name = payload.name;
  const tenantId = payload.tid;
  const picture = payload.picture;

  if (typeof subject !== 'string' || typeof email !== 'string' || subject.length === 0 || email.length === 0) {
    throw new AppError('Microsoft profile is missing required fields.', 400);
  }

  return {
    subject,
    email,
    name: typeof name === 'string' && name.length > 0 ? name : email,
    tenantId: typeof tenantId === 'string' && tenantId.length > 0 ? tenantId : null,
    pictureUrl: typeof picture === 'string' && picture.length > 0 ? picture : null
  };
}

export const buildIdentityRoutes = (deps: {
  authService: AuthService;
  organizationService: OrganizationService;
  workspaceInvitesService: WorkspaceInvitesService;
  allowedOrigins: string[];
}): Router => {
  const router = Router();
  const csrfGuard = createCsrfMiddleware({
    secret: env.CSRF_SECRET,
    allowedOrigins: deps.allowedOrigins
  });

  router.post(
    '/auth/register',
    registerLimiter,
    asyncHandler(async (req, res) => {
      const input = registerDto.parse(req.body);
      const result = await deps.authService.register(input, extractContext(req));

      if (result.refreshToken) {
        setSessionCookies(res, result.refreshToken);
      } else {
        clearSessionCookies(res);
      }
      setNoStore(res);
      res.status(201).json({
        user: result.user,
        accessToken: result.accessToken
      });
    })
  );

  router.post(
    '/auth/login',
    loginLimiter,
    asyncHandler(async (req, res) => {
      const input = loginDto.parse(req.body);
      const result = await deps.authService.login(input, extractContext(req));

      setSessionCookies(res, result.refreshToken);
      setNoStore(res);
      res.status(200).json({
        user: result.user,
        accessToken: result.accessToken
      });
    })
  );

  router.get(
    '/auth/workspace-invite/:token',
    asyncHandler(async (req, res) => {
      const token = req.params.token;
      if (!token || typeof token !== 'string') {
        throw new AppError('Missing invite token.', 400);
      }

      const invite = await deps.workspaceInvitesService.getInviteByToken(token);
      if (!invite) {
        res.status(404).json({ message: 'Invite not found.' });
        return;
      }

      res.status(200).json(invite);
    })
  );

  router.get(
    '/auth/google',
    asyncHandler(async (req, res) => {
      const state = randomBase64Url(32);
      const nonce = randomBase64Url(32);
      const pkceVerifier = randomBase64Url(64);
      const codeChallenge = sha256Base64Url(pkceVerifier);
      const redirectOriginFromQuery =
        typeof req.query.redirect_origin === 'string' ? req.query.redirect_origin : undefined;
      const inviteTokenFromQuery = typeof req.query.invite === 'string' ? req.query.invite : undefined;
      const returnOrigin =
        resolveAllowedOrigin(redirectOriginFromQuery, deps.allowedOrigins) ??
        resolveAllowedOrigin(req.headers.origin as string | undefined, deps.allowedOrigins) ??
        resolveAllowedOrigin(req.headers.referer as string | undefined, deps.allowedOrigins);

      setOauthFlowCookies(res, 'google', { state, nonce, pkceVerifier, returnOrigin, inviteToken: inviteTokenFromQuery });
      res.redirect(302, buildGoogleAuthorizeUrl({ state, nonce, codeChallenge }));
    })
  );

  router.get(
    '/auth/google/callback',
    asyncHandler(async (req, res) => {
      const providerError = req.query.error;
      const returnOrigin = req.cookies?.[oauthCookieName('google', 'return')] as string | undefined;
      if (typeof providerError === 'string' && providerError.length > 0) {
        clearOauthFlowCookies(res, 'google');
        res.redirect(
          302,
          resolveOAuthErrorRedirectUrl(
            deps.allowedOrigins,
            'google',
            resolveOAuthProviderErrorCode(providerError),
            returnOrigin
          )
        );
        return;
      }

      try {
        const code = req.query.code;
        const state = req.query.state;

        if (typeof code !== 'string' || code.length === 0) {
          throw new AppError('Google callback is missing code.', 400);
        }
        if (typeof state !== 'string' || state.length === 0) {
          throw new AppError('Google callback is missing state.', 400);
        }

        const expectedState = req.cookies?.[oauthCookieName('google', 'state')] as string | undefined;
        const expectedNonce = req.cookies?.[oauthCookieName('google', 'nonce')] as string | undefined;
        const pkceVerifier = req.cookies?.[oauthCookieName('google', 'pkce')] as string | undefined;
        const inviteToken = req.cookies?.[oauthCookieName('google', 'invite')] as string | undefined;

        clearOauthFlowCookies(res, 'google');

        if (!expectedState || !expectedNonce || !pkceVerifier) {
          throw new AppError('Google OAuth flow state is missing.', 400);
        }
        if (!timingSafeEqualString(state, expectedState)) {
          throw new AppError('Google OAuth state validation failed.', 400);
        }

        const tokenResult = await exchangeGoogleCodeForAccessToken(code, pkceVerifier);
        await validateGoogleIdTokenClaims(tokenResult.idToken, expectedNonce);
        const accessToken = tokenResult.accessToken;
        const profile = await fetchGoogleUserProfile(accessToken);
        let result;
        try {
          result = await deps.authService.loginWithExternal(
            {
              provider: 'GOOGLE',
              providerSubject: profile.subject,
              email: profile.email,
              name: profile.name,
              emailVerified: profile.emailVerified,
              providerAvatarUrl: profile.pictureUrl,
              inviteToken
            },
            extractContext(req)
          );
        } catch (error) {
          if (error instanceof AppError && error.statusCode === 409) {
            res.redirect(302, resolveLinkRequiredRedirectUrl(deps.allowedOrigins, 'google', returnOrigin));
            return;
          }
          throw error;
        }

        setSessionCookies(res, result.refreshToken);
        setNoStore(res);
        res.redirect(302, resolvePostAuthRedirectUrl(deps.allowedOrigins, returnOrigin));
      } catch (error) {
        clearOauthFlowCookies(res, 'google');
        res.redirect(
          302,
          resolveOAuthErrorRedirectUrl(deps.allowedOrigins, 'google', resolveOAuthCallbackErrorCode(error), returnOrigin)
        );
      }
    })
  );

  router.get(
    '/auth/microsoft',
    asyncHandler(async (req, res) => {
      const state = randomBase64Url(32);
      const nonce = randomBase64Url(32);
      const pkceVerifier = randomBase64Url(64);
      const codeChallenge = sha256Base64Url(pkceVerifier);
      const redirectOriginFromQuery =
        typeof req.query.redirect_origin === 'string' ? req.query.redirect_origin : undefined;
      const inviteTokenFromQuery = typeof req.query.invite === 'string' ? req.query.invite : undefined;
      const returnOrigin =
        resolveAllowedOrigin(redirectOriginFromQuery, deps.allowedOrigins) ??
        resolveAllowedOrigin(req.headers.origin as string | undefined, deps.allowedOrigins) ??
        resolveAllowedOrigin(req.headers.referer as string | undefined, deps.allowedOrigins);

      setOauthFlowCookies(res, 'microsoft', { state, nonce, pkceVerifier, returnOrigin, inviteToken: inviteTokenFromQuery });
      res.redirect(302, buildMicrosoftAuthorizeUrl({ state, nonce, codeChallenge }));
    })
  );

  router.get(
    '/auth/microsoft/callback',
    asyncHandler(async (req, res) => {
      const providerError = req.query.error;
      const returnOrigin = req.cookies?.[oauthCookieName('microsoft', 'return')] as string | undefined;
      if (typeof providerError === 'string' && providerError.length > 0) {
        clearOauthFlowCookies(res, 'microsoft');
        res.redirect(
          302,
          resolveOAuthErrorRedirectUrl(
            deps.allowedOrigins,
            'microsoft',
            resolveOAuthProviderErrorCode(providerError),
            returnOrigin
          )
        );
        return;
      }

      try {
        const code = req.query.code;
        const state = req.query.state;

        if (typeof code !== 'string' || code.length === 0) {
          throw new AppError('Microsoft callback is missing code.', 400);
        }
        if (typeof state !== 'string' || state.length === 0) {
          throw new AppError('Microsoft callback is missing state.', 400);
        }

        const expectedState = req.cookies?.[oauthCookieName('microsoft', 'state')] as string | undefined;
        const expectedNonce = req.cookies?.[oauthCookieName('microsoft', 'nonce')] as string | undefined;
        const pkceVerifier = req.cookies?.[oauthCookieName('microsoft', 'pkce')] as string | undefined;
        const inviteToken = req.cookies?.[oauthCookieName('microsoft', 'invite')] as string | undefined;

        clearOauthFlowCookies(res, 'microsoft');

        if (!expectedState || !expectedNonce || !pkceVerifier) {
          throw new AppError('Microsoft OAuth flow state is missing.', 400);
        }
        if (!timingSafeEqualString(state, expectedState)) {
          throw new AppError('Microsoft OAuth state validation failed.', 400);
        }

        const tokenResult = await exchangeMicrosoftCodeForAccessToken(code, pkceVerifier);
        await validateMicrosoftIdTokenClaims(tokenResult.idToken, expectedNonce);
        const accessToken = tokenResult.accessToken;
        const profile = await fetchMicrosoftUserProfile(accessToken);
        let result;
        try {
          result = await deps.authService.loginWithExternal(
            {
              provider: 'MICROSOFT',
              providerSubject: profile.subject,
              email: profile.email,
              name: profile.name,
              providerTenantId: profile.tenantId,
              providerAvatarUrl: profile.pictureUrl,
              inviteToken
            },
            extractContext(req)
          );
        } catch (error) {
          if (error instanceof AppError && error.statusCode === 409) {
            res.redirect(302, resolveLinkRequiredRedirectUrl(deps.allowedOrigins, 'microsoft', returnOrigin));
            return;
          }
          throw error;
        }

        setSessionCookies(res, result.refreshToken);
        setNoStore(res);
        res.redirect(302, resolvePostAuthRedirectUrl(deps.allowedOrigins, returnOrigin));
      } catch (error) {
        clearOauthFlowCookies(res, 'microsoft');
        res.redirect(
          302,
          resolveOAuthErrorRedirectUrl(
            deps.allowedOrigins,
            'microsoft',
            resolveOAuthCallbackErrorCode(error),
            returnOrigin
          )
        );
      }
    })
  );

  router.post(
    '/auth/refresh',
    refreshLimiter,
    csrfGuard,
    asyncHandler(async (req, res) => {
      const rawRefreshToken = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;

      if (!rawRefreshToken) {
        throw new AppError('No active session.', 401);
      }

      const tokens = await deps.authService.refresh(rawRefreshToken, extractContext(req));
      setSessionCookies(res, tokens.refreshToken);
      setNoStore(res);

      res.status(200).json({ accessToken: tokens.accessToken });
    })
  );

  router.post(
    '/auth/logout',
    csrfGuard,
    asyncHandler(async (req, res) => {
      const rawRefreshToken = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;

      if (rawRefreshToken) {
        await deps.authService.logout(rawRefreshToken, extractContext(req));
      }

      clearSessionCookies(res);
      setNoStore(res);
      res.status(204).send();
    })
  );

  router.post(
    '/auth/logout-all',
    authMiddleware,
    csrfGuard,
    asyncHandler(async (req, res) => {
      await deps.authService.logoutAll(req.auth!.userId, extractContext(req));

      clearSessionCookies(res);
      setNoStore(res);
      res.status(204).send();
    })
  );

  router.get(
    '/auth/me',
    authMiddleware,
    asyncHandler(async (req, res) => {
      const user = await deps.authService.me(req.auth!.userId);
      setNoStore(res);
      res.status(200).json(user);
    })
  );

  router.patch(
    '/auth/me',
    authMiddleware,
    csrfGuard,
    asyncHandler(async (req, res) => {
      const input = updateUserProfileDto.parse(req.body);
      const user = await deps.authService.updateProfile(req.auth!.userId, input);
      setNoStore(res);
      res.status(200).json(user);
    })
  );

  router.patch(
    '/auth/me/avatar',
    authMiddleware,
    csrfGuard,
    asyncHandler(async (req, res) => {
      const input = updateUserAvatarDto.parse(req.body);
      const user = await deps.authService.updateAvatar(req.auth!.userId, input);
      setNoStore(res);
      res.status(200).json(user);
    })
  );

  router.post(
    '/auth/password-reset/request',
    resetLimiter,
    asyncHandler(async (req, res) => {
      const { email } = requestPasswordResetDto.parse(req.body);
      const result = await deps.authService.requestPasswordReset(email, extractContext(req));

      setNoStore(res);
      res.status(200).json({
        message: 'If an account exists for this email, a reset link has been sent. Check your inbox.',
        ...result
      });
    })
  );

  router.post(
    '/auth/password-reset/confirm',
    resetLimiter,
    asyncHandler(async (req, res) => {
      const input = confirmPasswordResetDto.parse(req.body);
      await deps.authService.confirmPasswordReset(input, extractContext(req));

      clearSessionCookies(res);
      setNoStore(res);
      res.status(200).json({ message: 'Password updated. Please log in with your new password.' });
    })
  );

  router.post(
    '/auth/email-verification/resend',
    verifyResendLimiter,
    asyncHandler(async (req, res) => {
      const { email } = requestPasswordResetDto.parse(req.body);
      await deps.authService.resendEmailVerification(email);
      setNoStore(res);
      res.status(200).json({
        message: 'Se houver uma conta pendente de verificacao, o e-mail foi reenviado.'
      });
    })
  );

  router.get(
    '/auth/verify-email',
    asyncHandler(async (req, res) => {
      const token = req.query.token;
      if (typeof token !== 'string' || token.length === 0) {
        throw new AppError('Missing or invalid token.', 400);
      }
      await deps.authService.confirmEmail(token, extractContext(req));
      setNoStore(res);
      res.status(200).json({ message: 'E-mail confirmado com sucesso.' });
    })
  );

  router.post(
    '/organizations',
    authMiddleware,
    asyncHandler(async (req, res) => {
      const input = createOrganizationDto.parse(req.body);
      const organization = await deps.organizationService.createOrganization({
        ...input,
        ownerUserId: req.auth!.userId
      });

      res.status(201).json(organization);
    })
  );

  return router;
};

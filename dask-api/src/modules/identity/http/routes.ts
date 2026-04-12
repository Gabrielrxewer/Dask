import crypto from 'crypto';
import type { CookieOptions } from 'express';
import type { Response } from 'express';
import { Router } from 'express';
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
import {
  confirmPasswordResetDto,
  createOrganizationDto,
  loginDto,
  registerDto,
  requestPasswordResetDto
} from '@/modules/identity/http/dto';

const registerLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 10 });
const loginLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 20 });
const refreshLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 15 });
const resetLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 5 });

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

function resolvePostAuthRedirectUrl(allowedOrigins: string[]): string {
  const baseUrl = (allowedOrigins[0] ?? 'http://localhost:5173').replace(/\/+$/, '');
  return `${baseUrl}/login`;
}

function resolveLinkRequiredRedirectUrl(
  allowedOrigins: string[],
  provider: 'google' | 'microsoft'
): string {
  const baseUrl = (allowedOrigins[0] ?? 'http://localhost:5173').replace(/\/+$/, '');
  return `${baseUrl}/login?oauth=link_required&provider=${provider}`;
}

async function readJsonResponse(response: globalThis.Response): Promise<Record<string, unknown>> {
  const raw = (await response.json()) as unknown;
  return typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
}

type OAuthProvider = 'google' | 'microsoft';

type OidcIdTokenClaims = {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nonce?: string;
  tid?: string;
};

const OAUTH_MAX_AGE_MS = 10 * 60 * 1000;

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

function oauthCookieName(provider: OAuthProvider, key: 'state' | 'nonce' | 'pkce'): string {
  return `dask-oauth-${provider}-${key}`;
}

function setOauthFlowCookies(
  res: Response,
  provider: OAuthProvider,
  values: { state: string; nonce: string; pkceVerifier: string }
): void {
  const options = getOauthCookieOptions();
  res.cookie(oauthCookieName(provider, 'state'), values.state, options);
  res.cookie(oauthCookieName(provider, 'nonce'), values.nonce, options);
  res.cookie(oauthCookieName(provider, 'pkce'), values.pkceVerifier, options);
}

function clearOauthFlowCookies(res: Response, provider: OAuthProvider): void {
  const clearOptions = getClearOauthCookieOptions();
  res.clearCookie(oauthCookieName(provider, 'state'), clearOptions);
  res.clearCookie(oauthCookieName(provider, 'nonce'), clearOptions);
  res.clearCookie(oauthCookieName(provider, 'pkce'), clearOptions);
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

function validateAudienceClaim(aud: string | string[] | undefined, expectedClientId: string): boolean {
  if (typeof aud === 'string') {
    return aud === expectedClientId;
  }
  if (Array.isArray(aud)) {
    return aud.includes(expectedClientId);
  }
  return false;
}

function validateGoogleIdTokenClaims(idToken: string, expectedNonce: string): void {
  if (!env.GOOGLE_OAUTH_CLIENT_ID) {
    throw new AppError('Google OAuth is not configured.', 503);
  }

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

function validateMicrosoftIdTokenClaims(idToken: string, expectedNonce: string): void {
  if (!env.MICROSOFT_OAUTH_CLIENT_ID) {
    throw new AppError('Microsoft OAuth is not configured.', 503);
  }

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

  if (typeof subject !== 'string' || typeof email !== 'string' || subject.length === 0 || email.length === 0) {
    throw new AppError('Google profile is missing required fields.', 400);
  }

  return {
    subject,
    email,
    name: typeof name === 'string' && name.length > 0 ? name : email,
    emailVerified: typeof emailVerified === 'boolean' ? emailVerified : null
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

  if (typeof subject !== 'string' || typeof email !== 'string' || subject.length === 0 || email.length === 0) {
    throw new AppError('Microsoft profile is missing required fields.', 400);
  }

  return {
    subject,
    email,
    name: typeof name === 'string' && name.length > 0 ? name : email,
    tenantId: typeof tenantId === 'string' && tenantId.length > 0 ? tenantId : null
  };
}

export const buildIdentityRoutes = (deps: {
  authService: AuthService;
  organizationService: OrganizationService;
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

      setSessionCookies(res, result.refreshToken);
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
    '/auth/google',
    asyncHandler(async (_req, res) => {
      const state = randomBase64Url(32);
      const nonce = randomBase64Url(32);
      const pkceVerifier = randomBase64Url(64);
      const codeChallenge = sha256Base64Url(pkceVerifier);

      setOauthFlowCookies(res, 'google', { state, nonce, pkceVerifier });
      res.redirect(302, buildGoogleAuthorizeUrl({ state, nonce, codeChallenge }));
    })
  );

  router.get(
    '/auth/google/callback',
    asyncHandler(async (req, res) => {
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

      clearOauthFlowCookies(res, 'google');

      if (!expectedState || !expectedNonce || !pkceVerifier) {
        throw new AppError('Google OAuth flow state is missing.', 400);
      }
      if (!timingSafeEqualString(state, expectedState)) {
        throw new AppError('Google OAuth state validation failed.', 400);
      }

      const tokenResult = await exchangeGoogleCodeForAccessToken(code, pkceVerifier);
      validateGoogleIdTokenClaims(tokenResult.idToken, expectedNonce);
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
            emailVerified: profile.emailVerified
          },
          extractContext(req)
        );
      } catch (error) {
        if (error instanceof AppError && error.statusCode === 409) {
          res.redirect(302, resolveLinkRequiredRedirectUrl(deps.allowedOrigins, 'google'));
          return;
        }
        throw error;
      }

      setSessionCookies(res, result.refreshToken);
      setNoStore(res);
      res.redirect(302, resolvePostAuthRedirectUrl(deps.allowedOrigins));
    })
  );

  router.get(
    '/auth/microsoft',
    asyncHandler(async (_req, res) => {
      const state = randomBase64Url(32);
      const nonce = randomBase64Url(32);
      const pkceVerifier = randomBase64Url(64);
      const codeChallenge = sha256Base64Url(pkceVerifier);

      setOauthFlowCookies(res, 'microsoft', { state, nonce, pkceVerifier });
      res.redirect(302, buildMicrosoftAuthorizeUrl({ state, nonce, codeChallenge }));
    })
  );

  router.get(
    '/auth/microsoft/callback',
    asyncHandler(async (req, res) => {
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

      clearOauthFlowCookies(res, 'microsoft');

      if (!expectedState || !expectedNonce || !pkceVerifier) {
        throw new AppError('Microsoft OAuth flow state is missing.', 400);
      }
      if (!timingSafeEqualString(state, expectedState)) {
        throw new AppError('Microsoft OAuth state validation failed.', 400);
      }

      const tokenResult = await exchangeMicrosoftCodeForAccessToken(code, pkceVerifier);
      validateMicrosoftIdTokenClaims(tokenResult.idToken, expectedNonce);
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
            providerTenantId: profile.tenantId
          },
          extractContext(req)
        );
      } catch (error) {
        if (error instanceof AppError && error.statusCode === 409) {
          res.redirect(302, resolveLinkRequiredRedirectUrl(deps.allowedOrigins, 'microsoft'));
          return;
        }
        throw error;
      }

      setSessionCookies(res, result.refreshToken);
      setNoStore(res);
      res.redirect(302, resolvePostAuthRedirectUrl(deps.allowedOrigins));
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

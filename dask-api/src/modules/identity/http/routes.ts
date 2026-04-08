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

import { env } from '@/core/config/env';

export const SESSION_COOKIE_NAME =
  env.NODE_ENV === 'production' ? '__Host-session' : 'dask-session';

export const CSRF_COOKIE_NAME = 'dask-csrf';

type SameSiteAttr = 'strict' | 'lax' | 'none';

function parseDurationSeconds(value: string): number {
  const unit = value.slice(-1);
  const amount = Number.parseInt(value.slice(0, -1), 10);

  const unitSeconds: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400
  };

  return amount * (unitSeconds[unit] ?? 1);
}

function refreshMaxAgeMs(): number {
  return parseDurationSeconds(env.JWT_REFRESH_EXPIRES_IN) * 1000;
}

function isSecureCookie(): boolean {
  return env.NODE_ENV === 'production';
}

function resolveSessionSameSite(secure: boolean): SameSiteAttr {
  // Browsers reject SameSite=None cookies unless Secure=true.
  // In local HTTP development, silently downgrade to lax so session cookie is kept.
  if (env.COOKIE_SAME_SITE === 'none' && !secure) {
    return 'lax';
  }

  return env.COOKIE_SAME_SITE;
}

export function getSessionCookieOptions(): {
  httpOnly: true;
  secure: boolean;
  sameSite: SameSiteAttr;
  path: string;
  maxAge: number;
} {
  const secure = isSecureCookie();
  return {
    httpOnly: true,
    secure,
    sameSite: resolveSessionSameSite(secure),
    path: '/',
    maxAge: refreshMaxAgeMs()
  };
}

export function getCsrfCookieOptions(): {
  httpOnly: false;
  secure: boolean;
  sameSite: 'strict';
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: false,
    secure: isSecureCookie(),
    sameSite: 'strict',
    path: '/',
    maxAge: refreshMaxAgeMs()
  };
}

export function getClearSessionCookieOptions(): {
  httpOnly: true;
  secure: boolean;
  sameSite: SameSiteAttr;
  path: string;
  maxAge: number;
  expires: Date;
} {
  const secure = isSecureCookie();
  return {
    httpOnly: true,
    secure,
    sameSite: resolveSessionSameSite(secure),
    path: '/',
    maxAge: 0,
    expires: new Date(0)
  };
}

export function getClearCsrfCookieOptions(): {
  httpOnly: false;
  secure: boolean;
  sameSite: 'strict';
  path: string;
  maxAge: number;
  expires: Date;
} {
  return {
    httpOnly: false,
    secure: isSecureCookie(),
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
    expires: new Date(0)
  };
}

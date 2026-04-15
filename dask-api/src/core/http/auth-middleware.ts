import type { NextFunction, Request, Response } from 'express';
import type { MembershipRole } from '@prisma/client';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { env } from '@/core/config/env';
import { AppError } from '@/core/errors/app-error';

type AuthTokenPayload = JwtPayload & {
  sub: string;
  email: string;
  emailVerified?: boolean;
  roles?: string[];
  isPlatformAdmin?: boolean;
};

export const authMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    next(new AppError('Missing authorization header', 401));
    return;
  }

  const [, token] = authHeader.split(' ');
  if (!token) {
    next(new AppError('Invalid authorization header format', 401));
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthTokenPayload;
    if (payload.emailVerified !== true) {
      next(new AppError('Email not verified', 401));
      return;
    }
    req.auth = {
      userId: payload.sub,
      email: payload.email,
      roles: (payload.roles ?? []) as MembershipRole[],
      isPlatformAdmin: payload.isPlatformAdmin === true
    };
    next();
  } catch {
    next(new AppError('Invalid or expired token', 401));
  }
};

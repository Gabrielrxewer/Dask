import type { NextFunction, Request, Response } from 'express';
import { AppError } from '@/core/errors/app-error';

export const requirePlatformAdminMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  if (!req.auth) {
    next(new AppError('Unauthorized', 401));
    return;
  }

  if (req.auth.isPlatformAdmin !== true) {
    next(new AppError('Forbidden: platform admin required', 403));
    return;
  }

  next();
};

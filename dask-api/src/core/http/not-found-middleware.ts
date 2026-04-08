import type { Request, Response } from 'express';

export const notFoundMiddleware = (req: Request, res: Response): void => {
  res.status(404).json({
    message: `Route ${req.method} ${req.originalUrl} not found`
  });
};

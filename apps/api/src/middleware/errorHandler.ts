import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  console.error(`[API Error] ${req.method} ${req.originalUrl}:`, err);

  res.status(status).json({
    error: message,
    statusCode: status,
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
  });
}

export default errorHandler;

import env from '../config/env.js';

/**
 * Global error handler middleware
 * Catches all unhandled errors and returns a formatted response
 */
export const errorHandler = (err, req, res, _next) => {
  console.error('❌ Unhandled Error:', {
    message: err.message,
    stack: env.isDev ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });

  // Prisma errors
  if (err.code === 'P2002') {
    return res.status(409).json({
      error: 'Conflict',
      message: 'A record with this value already exists',
      field: err.meta?.target,
    });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Record not found',
    });
  }

  // Zod validation errors
  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid request data',
      details: err.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid token',
    });
  }

  // Default 500
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: env.isDev ? err.message : 'Something went wrong',
    ...(env.isDev && { stack: err.stack }),
  });
};
